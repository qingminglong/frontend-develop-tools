import { configuration } from './get-configuration.ts'
import path from 'path'
import fs from 'fs'
import type { ModuleInfo } from '../types/detect-changed-module.ts'
import type {
  PackageDependencyInfo,
  BuildedModule
} from '../types/build-modules.ts'
import {
  FILE_NAMES,
  ENCODINGS,
  PACKAGE_FIELDS,
  DEPENDENCY_TYPES,
  BUILD_REASON,
  SPECIAL_CHARS
} from '../consts/index.ts'
import { logToChat } from '../utils/index.ts'
import {
  executeBuildModules,
  analyzeModulesToBuild,
  sortModules
} from '../utils/build.ts'
import { getWorkspacePackages } from './detect-changed-module.ts'
import { glob } from 'glob'
import yaml from 'js-yaml'

/**
 * 全局变量：缓存所有需要编译的静态资源模块列表
 */
let cachedDesignBuildModules: BuildedModule[] = []

/**
 * 读取package.json并获取依赖信息
 * @param packageJsonPath - package.json文件路径
 * @returns 包依赖信息，如果没有build脚本则返回null
 */
function getPackageDependencies(packageJsonPath: string): {
  name: string
  dependencies: Set<string>
} | null {
  try {
    const content = fs.readFileSync(packageJsonPath, ENCODINGS.UTF8)
    const pkg = JSON.parse(content)

    // 检查是否存在 scripts.build，不存在则排除该模块
    if (!pkg.scripts || !pkg.scripts.build) {
      return null
    }

    const dependencies = new Set<string>()

    // 收集所有类型的依赖
    DEPENDENCY_TYPES.forEach((depType) => {
      if (pkg[depType]) {
        Object.keys(pkg[depType]).forEach((dep) => {
          dependencies.add(dep)
        })
      }
    })

    return {
      name: pkg[PACKAGE_FIELDS.NAME],
      dependencies
    }
  } catch (error) {
    logToChat(`读取${FILE_NAMES.PACKAGE_JSON}失败: ${packageJsonPath}`, error)
    return null
  }
}

/**
 * 从workspace中获取所有包的依赖信息
 * @param projectPath - 项目根目录路径
 * @returns 包依赖信息Map，key为包名，value为依赖信息
 */
function getAllPackageDependencies(
  projectPath: string
): Map<string, PackageDependencyInfo> {
  const dependencyMap = new Map<string, PackageDependencyInfo>()

  // 读取pnpm-workspace.yaml或lerna.json来获取所有包路径
  const workspaceFile = path.join(projectPath, FILE_NAMES.WORKSPACE_CONFIG)
  if (!fs.existsSync(workspaceFile)) {
    logToChat(`未找到workspace配置文件: ${workspaceFile}`)
    return dependencyMap
  }

  // 使用glob查找所有package.json
  const workspaceContent = fs.readFileSync(workspaceFile, ENCODINGS.UTF8)
  const workspaceConfig = yaml.load(workspaceContent) as { packages: string[] }

  workspaceConfig[PACKAGE_FIELDS.PACKAGES].forEach((pattern: string) => {
    if (pattern.startsWith(SPECIAL_CHARS.EXCLAMATION)) return // 跳过排除模式

    const matches = glob.globSync(pattern, {
      cwd: projectPath,
      absolute: false,
      ignore: ['**/node_modules/**']
    })

    matches.forEach((match: string) => {
      const packageJsonPath = path.join(
        projectPath,
        match,
        FILE_NAMES.PACKAGE_JSON
      )
      if (fs.existsSync(packageJsonPath)) {
        const depInfo = getPackageDependencies(packageJsonPath)
        if (depInfo) {
          dependencyMap.set(depInfo.name, {
            name: depInfo.name,
            path: path.join(projectPath, match),
            dependencies: depInfo.dependencies
          })
        }
      }
    })
  })

  return dependencyMap
}

/**
 * 分析并过滤静态模块
 * 合并依赖信息、进行拓扑排序并过滤出有build:umd脚本的模块
 * @param staticModulesToBuild - 要构建的静态模块列表
 * @param allDependencyMaps - 所有项目的依赖信息映射
 * @returns 过滤后的静态模块列表
 */
function analyzeAndFilterModules(
  staticModulesToBuild: ModuleInfo[],
  allDependencyMaps: Map<string, Map<string, PackageDependencyInfo>>
): BuildedModule[] {
  // 合并所有项目的依赖信息，用于跨项目依赖分析
  const mergedDependencyMap = new Map<string, PackageDependencyInfo>()
  allDependencyMaps.forEach((depMap) => {
    depMap.forEach((depInfo, pkgName) => {
      mergedDependencyMap.set(pkgName, depInfo)
    })
  })

  try {
    // 分析需要编译的所有静态模块（包括依赖关系）
    const modulesToBuild = analyzeModulesToBuild(
      staticModulesToBuild,
      mergedDependencyMap
    )

    // 进行拓扑排序，确保编译顺序正确
    const sortedModules = sortModules(modulesToBuild, mergedDependencyMap)

    // 过滤出实际存在的静态模块（确保只包含有build:umd脚本的模块）
    const finalModules = sortedModules.filter((module) => {
      try {
        const content = fs.readFileSync(
          path.join(module.modulePath, FILE_NAMES.PACKAGE_JSON),
          ENCODINGS.UTF8
        )
        const packageJson = JSON.parse(content)
        return packageJson.scripts && packageJson.scripts['build:umd']
      } catch {
        return false
      }
    })

    return finalModules
  } catch (error) {
    logToChat(
      '❌ 分析静态模块依赖关系时出错:',
      error instanceof Error ? error.message : error
    )
    // 出错时降级为仅返回直接找到的静态模块
    return staticModulesToBuild.map((module) => ({
      moduleName: module.moduleName,
      modulePath: module.modulePath,
      reason: BUILD_REASON.CHANGED
    }))
  }
}

/**
 * 获取静态资源构建模块列表
 * 从configuration.modulePaths中读取模块路径，检查package.json中是否包含build脚本
 * 支持依赖分析和拓扑排序，确保依赖模块也被包含在构建列表中
 * 结果会被缓存到 cachedStaticBuildModules
 * @returns 需要编译的静态模块列表
 */
export function getDesignBuildModules(): BuildedModule[] {
  // 清空缓存
  cachedDesignBuildModules = []

  const staticBuildedModules: BuildedModule[] = []

  logToChat('🔍 开始分析静态资源模块...')

  // 获取配置中的模块路径
  const { modulePaths } = configuration

  if (!modulePaths || modulePaths.length === 0) {
    logToChat('⚠️ 配置中未找到模块路径 (modulePaths)')
    return staticBuildedModules
  }

  // 收集所有静态模块和依赖信息
  const allDependencyMaps = new Map<
    string,
    Map<string, PackageDependencyInfo>
  >()
  const staticModulesToBuild: ModuleInfo[] = []

  // 遍历每个模块路径
  modulePaths.forEach((modulePath) => {
    try {
      // 获取该路径下的所有工作区包
      const packages = getWorkspacePackages(modulePath)
      if (packages.length === 0) {
        logToChat(`   ⚠️ 跳过 ${modulePath}: 未找到工作区包`)
        return
      }

      // 获取该项目的依赖信息
      const dependencyMap = getAllPackageDependencies(modulePath)
      allDependencyMaps.set(modulePath, dependencyMap)

      // 在所有包中检查是否有build脚本
      for (const pkg of packages) {
        try {
          // 读取并解析package.json
          const content = fs.readFileSync(pkg.packageJsonPath, ENCODINGS.UTF8)
          const packageJson = JSON.parse(content)

          // ****检查是否存在scripts['build:umd']****
          if (!packageJson.scripts || !packageJson.scripts['build:umd']) {
            continue
          }

          // 添加到构建列表
          const moduleName =
            packageJson[PACKAGE_FIELDS.NAME] || path.basename(pkg.path)
          staticModulesToBuild.push({
            moduleName,
            modulePath: pkg.path
          })

          logToChat(`   ✅ 添加UMD模块: ${moduleName}`)
        } catch (error) {
          logToChat(
            `   ❌ 处理包 ${pkg.name} 时出错:`,
            error instanceof Error ? error.message : String(error)
          )
        }
      }
    } catch (error) {
      logToChat(
        `   ❌ 处理模块路径 ${modulePath} 时出错:`,
        error instanceof Error ? error.message : String(error)
      )
    }
  })

  // 如果没有找到任何静态模块，直接返回
  if (staticModulesToBuild.length === 0) {
    logToChat('\n📊 静态资源模块分析完成: 未找到需要构建的模块\n')
    return staticBuildedModules
  }

  // 分析并过滤静态模块
  const finalModules = analyzeAndFilterModules(
    staticModulesToBuild,
    allDependencyMaps
  )

  staticBuildedModules.push(...finalModules)

  logToChat(
    `\n📊 静态资源模块分析完成: 共 ${finalModules.length} 个模块需要构建`
  )
  finalModules.forEach((m, index) => {
    const reasonText =
      m.reason === BUILD_REASON.CHANGED
        ? '直接变更'
        : `被依赖 (${m.dependedBy?.join(SPECIAL_CHARS.COMMA + ' ') ?? ''})`
    logToChat(`   ${index + 1}. ${m.moduleName} - ${reasonText}`)
  })
  logToChat('')

  // 更新缓存
  cachedDesignBuildModules = staticBuildedModules

  return staticBuildedModules
}

/**
 * 获取缓存的静态资源构建模块列表
 * @returns 缓存的静态模块列表
 */
export function getCachedStaticBuildModules(): BuildedModule[] {
  return cachedDesignBuildModules
}

/**
 * 执行静态资源模块编译
 * 调用getStaticBuildModules获取模块列表并执行编译
 * @returns 编译是否成功执行
 */
export function buildDesignModules(): boolean {
  const modules = getDesignBuildModules()
  return executeBuildModules(modules, true)
}
