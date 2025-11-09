import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import type {
  BuildedModule,
  PackageDependencyInfo
} from '../types/build-modules.ts'
import type { ModuleInfo } from '../types/detect-changed-module.ts'
import { BUILD_REASON, SPECIAL_CHARS, LOG_MESSAGES } from '../consts/index.ts'
import { logToChat, parseWorkspacePatterns } from './index.ts'
import { configuration } from '../domain/get-configuration.ts'
import { getEnableSharedDepend } from '../service/build-modules.ts'

/**
 * 通用的模块编译函数
 * @param modules - 需要编译的模块列表
 * @param isDesign - 是否为设计态编译，如果为true则执行build:umd，否则执行build
 * @returns 编译是否成功执行
 */
export function executeBuildModules(
  modules: BuildedModule[],
  isDesign: boolean
): boolean {
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
      // 根据isDesign确定编译命令
      const buildCommand = isDesign ? 'build:umd' : 'build'

      // 执行编译命令
      logToChat(`   🔨 执行编译命令: pnpm run ${buildCommand}`)

      const startTime = Date.now()

      execSync(`pnpm run ${buildCommand}`, {
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

/**
 * 获取 pnpm-workspace.yaml 中被排除的包模式列表
 * @returns 被排除的包模式数组
 */
export function getExcludedModules(): string[] {
  try {
    const excludeModulesSet = new Set<string>()

    // 遍历所有模块路径，收集排除模式
    for (const modulePath of configuration.modulePaths) {
      const { excludeModules } = parseWorkspacePatterns(modulePath)
      excludeModules.forEach((pattern) => excludeModulesSet.add(pattern))
    }

    return Array.from(excludeModulesSet)
  } catch (error) {
    logToChat(
      `读取 pnpm-workspace.yaml 失败: ${
        error instanceof Error ? error.message : error
      }`
    )
    return []
  }
}

/**
 * 检查模块是否被排除
 * @param modulePath - 模块绝对路径
 * @param excludeModules - 排除模式列表（相对路径）
 * @returns 是否被排除
 */
export function isModuleExcluded(
  modulePath: string,
  excludeModules: string[]
): boolean {
  // 如果没有排除模式，直接返回 false
  if (excludeModules.length === 0) {
    return false
  }

  // 将绝对路径转换为相对于 workspace 的相对路径
  // 找到 workspace 根目录（通常是 modulePaths 中的父目录）
  let relativePath = modulePath

  // 尝试从配置的模块路径中找到匹配的 workspace 根目录
  for (const workspacePath of configuration.modulePaths) {
    if (modulePath.startsWith(workspacePath)) {
      // 计算相对于 workspace 的路径
      relativePath = path.relative(workspacePath, modulePath)
      // 统一路径分隔符为正斜杠（兼容不同操作系统）
      relativePath = relativePath.replace(/\\/g, '/')
      break
    }
  }

  // 检查是否匹配任何排除模式
  return excludeModules.some((excludePattern) => {
    // 支持精确匹配和路径前缀匹配
    return (
      relativePath === excludePattern ||
      relativePath.startsWith(excludePattern + '/')
    )
  })
}

/**
 * 分析需要编译的所有模块（包括变更的模块和依赖它们的父模块）
 * @param changedModules - 变更的模块列表
 * @param dependencyMap - 所有包的依赖信息
 * @returns 需要编译的完整模块列表
 */
export function analyzeModulesToBuild(
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

  // 获取是否启用共享依赖
  const enableSharedDepend = getEnableSharedDepend()

  // 获取shared目录下所有package.json的name字段
  const sharedPackageNames = enableSharedDepend ? getSharedPackageNames() : new Set<string>()

  // 过滤出filterChangedModules
  const filterChangedModules = changedModules.filter((module) => {
    // 如果启用了共享依赖，则排除shared目录下的包
    if (enableSharedDepend && sharedPackageNames.has(module.moduleName)) {
      return false
    }
    return true
  })
  console.log(
    '🚀 ~ analyzeModulesToBuild ~ filterChangedModules:',
    filterChangedModules
  )

  // 对每个变更的模块，查找依赖它的父模块
  filterChangedModules.forEach((module) => {
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
        const module = buildModulesMap.get(depName)!
        if (!module.dependedBy) {
          module.dependedBy = []
        }
        if (!module.dependedBy.includes(module.moduleName)) {
          module.dependedBy.push(module.moduleName)
        }
      }
    })
  })

  // 获取被排除的包模式列表
  const excludedModules = getExcludedModules()
  // 过滤掉被排除的模块
  const filteredModules = Array.from(buildModulesMap.values()).filter(
    (module) => {
      const isExcluded = isModuleExcluded(module.modulePath, excludedModules)
      console.error(module.modulePath)
      if (isExcluded) {
        logToChat(`跳过被排除的模块: ${module.moduleName}`)
      }
      return !isExcluded
    }
  )

  return filteredModules
}

/**
 * 查找依赖指定模块的所有父模块（递归）
 * @param moduleName - 模块名
 * @param dependencyMap - 所有包的依赖信息
 * @param visited - 已访问的模块集合，防止循环依赖
 * @returns 依赖该模块的所有父模块名称列表
 */
export function findDependentModules(
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
 * 对模块列表进行拓扑排序，确保依赖顺序正确
 * @param modules - 需要编译的模块列表
 * @param dependencyMap - 所有包的依赖信息
 * @returns 排序后的模块列表（被依赖的模块在前）
 */
export function sortModules(
  modules: BuildedModule[],
  dependencyMap: Map<string, PackageDependencyInfo>
): BuildedModule[] {
  const sorted: BuildedModule[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  function visit(moduleName: string, module: BuildedModule) {
    if (visited.has(moduleName)) return
    if (visiting.has(moduleName)) {
      logToChat('检测到循环依赖: ' + moduleName)
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
 * 获取shared目录下所有package.json文件的name字段
 * @returns shared目录下所有package.json的name字段集合
 */
function getSharedPackageNames(): Set<string> {
  const sharedPackageNames = new Set<string>()

  // 遍历所有模块路径
  for (const modulePath of configuration.modulePaths) {
    const sharedDir = path.join(modulePath, 'shared')

    // 检查shared目录是否存在
    if (!fs.existsSync(sharedDir)) {
      continue
    }

    // 递归查找shared目录下的所有package.json文件
    const findPackageJsonFiles = (dir: string) => {
      try {
        const items = fs.readdirSync(dir)

        for (const item of items) {
          const itemPath = path.join(dir, item)
          const stat = fs.statSync(itemPath)

          if (stat.isDirectory()) {
            // 递归查找子目录
            findPackageJsonFiles(itemPath)
          } else if (item === 'package.json') {
            // 读取package.json文件并提取name字段
            try {
              const packageJson = JSON.parse(fs.readFileSync(itemPath, 'utf8'))
              if (packageJson.name && typeof packageJson.name === 'string') {
                sharedPackageNames.add(packageJson.name)
              }
            } catch (error) {
              // 忽略读取或解析失败的文件
              console.warn(`无法解析package.json: ${itemPath}`, error)
            }
          }
        }
      } catch (error) {
        // 忽略无法读取的目录
        console.warn(`无法读取目录: ${dir}`, error)
      }
    }

    findPackageJsonFiles(sharedDir)
  }

  return sharedPackageNames
}
