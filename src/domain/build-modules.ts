import { modulesInfosDetail } from './detect-changed-module.ts'
import { configuration } from './get-configuration.ts'
import { execSync } from 'child_process'
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

/**
 * 全局变量：缓存所有需要编译的模块列表
 */
let cachedBuildModules: BuildedModule[] = []

/**
 * 全局变量：标识所有模块是否已经编译完成
 */
let isFinished = false

/**
 * 全局变量：缓存所有需要编译的静态资源模块列表
 */
let cachedStaticBuildModules: BuildedModule[] = []

/**
 * 重置全局变量
 * 用于清理进程退出或MCP被禁用时的缓存状态
 */
export function resetBuildModulesGlobals(): void {
  cachedBuildModules = []
  isFinished = false
  cachedStaticBuildModules = []
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
      logToChat(
        `跳过模块 ${
          pkg[PACKAGE_FIELDS.NAME] || '未知'
        }: 缺少 scripts.build 配置`
      )
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
      absolute: false
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

  if (modules.length === 0) {
    logToChat(LOG_MESSAGES.NO_MODULES_TO_BUILD)
    return true
  }

  logToChat(LOG_MESSAGES.BUILD_START.replace('{count}', String(modules.length)))

  let successCount = 0
  let failCount = 0

  modules.forEach((module, index) => {
    const reasonText =
      module.reason === BUILD_REASON.CHANGED
        ? '直接变更'
        : `被依赖 (${module.dependedBy?.join(SPECIAL_CHARS.COMMA + ' ') ?? ''})`

    logToChat(`[${index + 1}/${modules.length}] 编译模块: ${module.moduleName}`)
    logToChat(`   路径: ${module.modulePath}`)
    logToChat(`   原因: ${reasonText}`)

    try {
      // 执行 pnpm run build 命令
      logToChat(`   🔨 执行编译命令: pnpm run build`)

      const startTime = Date.now()

      execSync('pnpm run build', {
        cwd: module.modulePath,
        stdio: 'inherit', // 将编译输出直接显示在控制台
        encoding: 'utf8',
        timeout: 600000 // 5分钟超时
      })

      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      logToChat(`   ✅ 编译成功 (耗时: ${duration}s)${SPECIAL_CHARS.NEWLINE}`)
      successCount++
    } catch (error) {
      logToChat(
        `   ❌ 编译失败:`,
        error instanceof Error ? error.message : error
      )
      logToChat(SPECIAL_CHARS.NEWLINE)
      failCount++
    }
  })

  logToChat(`\n📊 编译统计:`)
  logToChat(`   ✅ 成功: ${successCount}`)
  logToChat(`   ❌ 失败: ${failCount}`)
  logToChat(`   📦 总计: ${modules.length}\n`)

  // 根据编译结果返回状态
  if (failCount > 0) {
    logToChat(`❌ 编译完成，但有 ${failCount} 个模块编译失败`)
    return false
  }

  logToChat(LOG_MESSAGES.BUILD_COMPLETE)
  return true
}

/**
 * 从workspace路径下获取所有工作区包的信息
 * @param modulePath - 项目根目录路径
 * @returns 包信息数组
 */
function getWorkspacePackages(modulePath: string): Array<{
  name: string
  path: string
  srcPath: string
  packageJsonPath: string
}> {
  const workspaceFile = path.join(modulePath, FILE_NAMES.WORKSPACE_CONFIG)
  // 如果不存在workspace文件，返回空数组
  if (!fs.existsSync(workspaceFile)) {
    logToChat(`   ⚠️ workspace 文件不存在: ${workspaceFile}`)
    return []
  }

  try {
    const content = fs.readFileSync(workspaceFile, ENCODINGS.UTF8)
    const config = yaml.load(content) as { packages: string[] }
    const packages: Array<{
      name: string
      path: string
      srcPath: string
      packageJsonPath: string
    }> = []

    logToChat(
      `   📄 workspace 配置包含 ${
        config[PACKAGE_FIELDS.PACKAGES].length
      } 个 pattern`
    )

    config[PACKAGE_FIELDS.PACKAGES].forEach((pattern: string) => {
      // 跳过排除模式
      if (pattern.startsWith(SPECIAL_CHARS.EXCLAMATION)) {
        logToChat(`   ⏭️  跳过排除模式: ${pattern}`)
        return
      }

      logToChat(`   🔍 解析 pattern: ${pattern}`)

      // 解析glob pattern
      const matches = glob.globSync(pattern, {
        cwd: modulePath,
        absolute: false
      })

      logToChat(`      找到 ${matches.length} 个匹配`)

      matches.forEach((match: string) => {
        const packagePath = path.join(modulePath, match)
        const srcPath = path.join(packagePath, FILE_NAMES.SRC_DIR)
        const packageJsonPath = path.join(packagePath, FILE_NAMES.PACKAGE_JSON)

        const hasSrc = fs.existsSync(srcPath)
        const hasPackageJson = fs.existsSync(packageJsonPath)

        // 检查是否存在src目录和package.json
        if (hasSrc && hasPackageJson) {
          packages.push({
            name: match,
            path: packagePath,
            srcPath: srcPath,
            packageJsonPath: packageJsonPath
          })
          logToChat(`      ✅ 添加有效包: ${match}`)
        }
      })
    })

    logToChat(`   📦 总共找到 ${packages.length} 个有效包`)
    return packages
  } catch (error) {
    logToChat(
      `   ⚠️ 解析 workspace 配置失败: ${modulePath}`,
      error instanceof Error ? error.message : String(error)
    )
    return []
  }
}

/**
 * 获取静态资源构建模块列表
 * 从configuration.modulePaths中读取模块路径，检查package.json中是否包含build脚本
 * 结果会被缓存到 cachedStaticBuildModules
 * @returns 需要编译的静态模块列表
 */
export function getStaticBuildModules(): BuildedModule[] {
  // 清空缓存
  cachedStaticBuildModules = []

  const staticBuildedModules: BuildedModule[] = []

  logToChat('🔍 开始分析静态资源模块...')

  // 获取配置中的模块路径
  const { modulePaths } = configuration

  if (!modulePaths || modulePaths.length === 0) {
    logToChat('⚠️ 配置中未找到模块路径 (modulePaths)')
    return staticBuildedModules
  }
  // 遍历每个模块路径
  modulePaths.forEach((modulePath) => {
    try {
      // 获取该路径下的所有工作区包
      const packages = getWorkspacePackages(modulePath)

      if (packages.length === 0) {
        logToChat(`   ⚠️ 跳过 ${modulePath}: 未找到工作区包`)
        return
      }

      // 在所有包中检查是否有build脚本
      for (const pkg of packages) {
        try {
          // 读取并解析package.json
          const content = fs.readFileSync(pkg.packageJsonPath, ENCODINGS.UTF8)
          const packageJson = JSON.parse(content)

          // 检查是否存在scripts.build
          if (!packageJson.scripts || !packageJson.scripts['build:umd']) {
            continue
          }

          // 添加到构建列表
          const moduleName =
            packageJson[PACKAGE_FIELDS.NAME] || path.basename(pkg.path)
          staticBuildedModules.push({
            moduleName,
            modulePath: pkg.path,
            reason: BUILD_REASON.CHANGED
          })

          logToChat(`   ✅ 添加模块: ${moduleName}`)
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

  logToChat(
    `\n📊 静态资源模块分析完成: 共 ${staticBuildedModules.length} 个模块需要构建\n`
  )

  // 更新缓存
  cachedStaticBuildModules = staticBuildedModules

  return staticBuildedModules
}

/**
 * 获取缓存的静态资源构建模块列表
 * @returns 缓存的静态模块列表
 */
export function getCachedStaticBuildModules(): BuildedModule[] {
  return cachedStaticBuildModules
}

/**
 * 执行静态资源模块编译
 * 调用getStaticBuildModules获取模块列表并执行编译
 * @returns 编译是否成功执行
 */
export function buildStaticModules(): boolean {
  const modules = getStaticBuildModules()

  if (modules.length === 0) {
    logToChat(LOG_MESSAGES.NO_MODULES_TO_BUILD)
    return true
  }

  logToChat(LOG_MESSAGES.BUILD_START.replace('{count}', String(modules.length)))

  let successCount = 0
  let failCount = 0

  modules.forEach((module, index) => {
    const reasonText =
      module.reason === BUILD_REASON.CHANGED
        ? '直接变更'
        : `被依赖 (${module.dependedBy?.join(SPECIAL_CHARS.COMMA + ' ') ?? ''})`

    logToChat(`[${index + 1}/${modules.length}] 编译模块: ${module.moduleName}`)
    logToChat(`   路径: ${module.modulePath}`)
    logToChat(`   原因: ${reasonText}`)

    try {
      // 执行 pnpm run build 命令
      logToChat(`   🔨 执行编译命令: pnpm run build:umd`)

      const startTime = Date.now()

      execSync('pnpm run build:umd', {
        cwd: module.modulePath,
        stdio: 'inherit', // 将编译输出直接显示在控制台
        encoding: 'utf8',
        timeout: 600000 // 10分钟超时
      })

      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      logToChat(`   ✅ 编译成功 (耗时: ${duration}s)${SPECIAL_CHARS.NEWLINE}`)
      successCount++
    } catch (error) {
      logToChat(
        `   ❌ 编译失败:`,
        error instanceof Error ? error.message : error
      )
      logToChat(SPECIAL_CHARS.NEWLINE)
      failCount++
    }
  })

  logToChat(`\n📊 编译统计:`)
  logToChat(`   ✅ 成功: ${successCount}`)
  logToChat(`   ❌ 失败: ${failCount}`)
  logToChat(`   📦 总计: ${modules.length}\n`)

  // 根据编译结果返回状态
  if (failCount > 0) {
    logToChat(`❌ 编译完成，但有 ${failCount} 个模块编译失败`)
    return false
  }

  logToChat(LOG_MESSAGES.BUILD_COMPLETE)
  return true
}
