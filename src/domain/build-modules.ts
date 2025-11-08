import { modulesInfosDetail } from './detect-changed-module.ts'
import path from 'path'
import fs from 'fs'
import { glob } from 'glob'
import yaml from 'js-yaml'
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
  SPECIAL_CHARS,
  LOG_MESSAGES
} from '../consts/index.ts'
import { logToChat } from '../utils/index.ts'
import { executeBuildModules } from '../utils/build.ts'
/**
 * 全局变量：缓存所有需要编译的模块列表
 */
let cachedBuildModules: BuildedModule[] = []

/**
 * 全局变量：标识所有模块是否已经编译完成
 */
let isFinished = false

/**
 * 重置全局变量
 * 用于清理进程退出或MCP被禁用时的缓存状态
 */
export function resetBuildModulesGlobals(): void {
  cachedBuildModules = []
  isFinished = false
}

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
 * 查找依赖指定模块的所有父模块（递归）
 * @param moduleName - 模块名
 * @param dependencyMap - 所有包的依赖信息
 * @param visited - 已访问的模块集合，防止循环依赖
 * @returns 依赖该模块的所有父模块名称列表
 */
function findDependentModules(
  moduleName: string,
  dependencyMap: Map<string, PackageDependencyInfo>,
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(moduleName)) {
    return [] // 防止循环依赖
  }
  visited.add(moduleName)

  const dependents: string[] = []

  // 遍历所有包，找出依赖当前模块的包
  dependencyMap.forEach((pkgInfo, pkgName) => {
    if (pkgInfo.dependencies.has(moduleName)) {
      dependents.push(pkgName)
      // 递归查找依赖这个父模块的其他模块
      const transitiveDependents = findDependentModules(
        pkgName,
        dependencyMap,
        visited
      )
      dependents.push(...transitiveDependents)
    }
  })

  return [...new Set(dependents)] // 去重
}

/**
 * 分析需要编译的所有模块（包括变更的模块和依赖它们的父模块）
 * @param changedModules - 变更的模块列表
 * @param dependencyMap - 所有包的依赖信息
 * @returns 需要编译的完整模块列表
 */
function analyzeModulesToBuild(
  changedModules: ModuleInfo[],
  dependencyMap: Map<string, PackageDependencyInfo>
): BuildedModule[] {
  const buildModulesMap = new Map<string, BuildedModule>()

  // 首先添加所有变更的模块
  changedModules.forEach((module) => {
    buildModulesMap.set(module.moduleName, {
      moduleName: module.moduleName,
      modulePath: module.modulePath,
      reason: BUILD_REASON.CHANGED
    })
  })

  // 对每个变更的模块，查找依赖它的父模块
  changedModules.forEach((module) => {
    const dependents = findDependentModules(module.moduleName, dependencyMap)

    dependents.forEach((depName) => {
      const depInfo = dependencyMap.get(depName)
      if (depInfo && !buildModulesMap.has(depName)) {
        buildModulesMap.set(depName, {
          moduleName: depName,
          modulePath: depInfo.path,
          reason: BUILD_REASON.DEPENDENT,
          dependedBy: [module.moduleName]
        })
      } else if (
        depInfo &&
        buildModulesMap.get(depName)?.reason === BUILD_REASON.DEPENDENT
      ) {
        // 如果已存在且是dependent，添加到dependedBy列表
        const existing = buildModulesMap.get(depName)!
        if (!existing.dependedBy) {
          existing.dependedBy = []
        }
        if (!existing.dependedBy.includes(module.moduleName)) {
          existing.dependedBy.push(module.moduleName)
        }
      }
    })
  })

  return Array.from(buildModulesMap.values())
}

/**
 * 对模块列表进行拓扑排序，确保依赖顺序正确
 * @param modules - 需要编译的模块列表
 * @param dependencyMap - 所有包的依赖信息
 * @returns 排序后的模块列表（被依赖的模块在前）
 */
function topologicalSort(
  modules: BuildedModule[],
  dependencyMap: Map<string, PackageDependencyInfo>
): BuildedModule[] {
  const sorted: BuildedModule[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  function visit(moduleName: string, module: BuildedModule) {
    if (visited.has(moduleName)) return
    if (visiting.has(moduleName)) {
      logToChat(LOG_MESSAGES.CIRCULAR_DEPENDENCY.replace('{name}', moduleName))
      return
    }

    visiting.add(moduleName)

    // 先访问所有依赖（在modules列表中的依赖）
    const depInfo = dependencyMap.get(moduleName)
    if (depInfo) {
      depInfo.dependencies.forEach((dep) => {
        const depModule = modules.find((m) => m.moduleName === dep)
        if (depModule && !visited.has(dep)) {
          visit(dep, depModule)
        }
      })
    }

    visiting.delete(moduleName)
    visited.add(moduleName)
    sorted.push(module)
  }

  modules.forEach((module) => {
    if (!visited.has(module.moduleName)) {
      visit(module.moduleName, module)
    }
  })

  return sorted
}

/**
 * 主函数：遍历所有项目并分析需要编译的模块
 * @returns 按项目分组的编译模块信息
 */
function getBuildedModules(): Record<string, BuildedModule[]> {
  const result: Record<string, BuildedModule[]> = {}

  logToChat(LOG_MESSAGES.ANALYZE_START)

  // 任务一和任务二：遍历modulesInfosDetail对象
  Object.entries(modulesInfosDetail).forEach(
    ([projectPath, modulesInfos]: [string, ModuleInfo[]]) => {
      if (modulesInfos.length === 0) {
        logToChat(LOG_MESSAGES.NO_CHANGES_SKIP.replace('{path}', projectPath))
        return
      }

      logToChat(LOG_MESSAGES.PROJECT_PATH.replace('{path}', projectPath))
      logToChat(
        LOG_MESSAGES.MODULES_DETECTED.replace(
          '{count}',
          String(modulesInfos.length)
        )
      )
      modulesInfos.forEach((m) => {
        logToChat(`   - ${m.moduleName}`)
      })

      // 任务三：分析依赖关系并找出所有需要编译的模块
      try {
        // 获取该项目所有包的依赖信息
        const dependencyMap = getAllPackageDependencies(projectPath)

        if (dependencyMap.size === 0) {
          logToChat(LOG_MESSAGES.NO_DEPENDENCY_INFO)
          result[projectPath] = modulesInfos.map(
            (m): BuildedModule => ({
              moduleName: m.moduleName,
              modulePath: m.modulePath,
              reason: BUILD_REASON.CHANGED
            })
          )
        } else {
          // 分析需要编译的所有模块（包括依赖关系）
          const modulesToBuild = analyzeModulesToBuild(
            modulesInfos,
            dependencyMap
          )

          // 进行拓扑排序，确保编译顺序正确
          const sortedModules = topologicalSort(modulesToBuild, dependencyMap)

          result[projectPath] = sortedModules

          logToChat(
            LOG_MESSAGES.BUILD_TOTAL.replace(
              '{count}',
              String(sortedModules.length)
            )
          )
          sortedModules.forEach((m, index) => {
            const reasonText =
              m.reason === BUILD_REASON.CHANGED
                ? '直接变更'
                : `被依赖 (${
                    m.dependedBy?.join(SPECIAL_CHARS.COMMA + ' ') ?? ''
                  })`
            logToChat(`   ${index + 1}. ${m.moduleName} - ${reasonText}`)
          })
        }
      } catch (error) {
        logToChat(
          `❌ 分析项目 ${projectPath} 时出错:`,
          error instanceof Error ? error.message : error
        )
        // 出错时降级为仅编译变更的模块
        result[projectPath] = modulesInfos.map(
          (m): BuildedModule => ({
            moduleName: m.moduleName,
            modulePath: m.modulePath,
            reason: BUILD_REASON.CHANGED
          })
        )
      }

      logToChat(
        SPECIAL_CHARS.NEWLINE +
          SPECIAL_CHARS.SEPARATOR.repeat(80) +
          SPECIAL_CHARS.NEWLINE
      )
    }
  )

  return result
}

/**
 * 获取需要编译的模块列表（扁平化，不分项目）
 * 调用前会清空缓存并重置状态
 * @returns 所有需要编译的模块列表
 */
export function getAllBuildedModules(): BuildedModule[] {
  // 调用前清空缓存
  cachedBuildModules = []
  // 重置编译完成状态
  isFinished = false

  const buildedModules = getBuildedModules()
  const modules = Object.values(buildedModules).flat()

  // 更新缓存
  cachedBuildModules = modules
  isFinished = true
  return modules
}

/**
 * 获取缓存的编译模块列表
 * @returns 缓存的模块列表
 */
export function getCachedBuildModules(): BuildedModule[] {
  return cachedBuildModules
}

/**
 * 执行模块编译
 * 遍历缓存的全局变量进行编译
 * 只有当 isReady 为 true 时才会执行
 * @returns 编译是否成功执行
 */
export function buildModules(): boolean {
  if (!isFinished) {
    logToChat(LOG_MESSAGES.BUILD_NOT_READY)
    return false
  }

  const modules = getCachedBuildModules()
  return executeBuildModules(modules, 'build')
}
