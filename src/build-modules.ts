import { modulesInfosDetail } from './detect-changed-modules.js'
import path from 'path'
import fs from 'fs'
import { glob } from 'glob'
import yaml from 'js-yaml'
import type { ModuleInfo } from './types/detect-changed-modules.js'
import type {
  PackageDependencyInfo,
  BuildedModule
} from './types/build-modules.js'

/**
 * 全局变量：缓存所有需要编译的模块列表
 */
let cachedBuildModules: BuildedModule[] = []

/**
 * 全局变量：标识所有模块是否已经编译完成
 */
let isReady = false

/**
 * callback 变化时的回调函数
 */
let callback: () => void = () => {}

/**
 * 读取package.json并获取依赖信息
 * @param packageJsonPath - package.json文件路径
 * @returns 包依赖信息
 */
function getPackageDependencies(packageJsonPath: string): {
  name: string
  dependencies: Set<string>
} | null {
  try {
    const content = fs.readFileSync(packageJsonPath, 'utf8')
    const pkg = JSON.parse(content)
    const dependencies = new Set<string>()

    // 收集所有类型的依赖
    const depTypes = ['dependencies', 'devDependencies', 'peerDependencies']
    depTypes.forEach((depType) => {
      if (pkg[depType]) {
        Object.keys(pkg[depType]).forEach((dep) => {
          dependencies.add(dep)
        })
      }
    })

    return {
      name: pkg.name,
      dependencies
    }
  } catch (error) {
    console.error(`读取package.json失败: ${packageJsonPath}`, error)
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
  const workspaceFile = path.join(projectPath, 'pnpm-workspace.yaml')
  if (!fs.existsSync(workspaceFile)) {
    console.error(`未找到workspace配置文件: ${workspaceFile}`)
    return dependencyMap
  }

  // 使用glob查找所有package.json
  const workspaceContent = fs.readFileSync(workspaceFile, 'utf8')
  const workspaceConfig = yaml.load(workspaceContent) as { packages: string[] }

  workspaceConfig.packages.forEach((pattern: string) => {
    if (pattern.startsWith('!')) return // 跳过排除模式

    const matches = glob.globSync(pattern, {
      cwd: projectPath,
      absolute: false
    })

    matches.forEach((match: string) => {
      const packageJsonPath = path.join(projectPath, match, 'package.json')
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
      reason: 'changed'
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
          reason: 'dependent',
          dependedBy: [module.moduleName]
        })
      } else if (
        depInfo &&
        buildModulesMap.get(depName)?.reason === 'dependent'
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
      console.error(`检测到循环依赖: ${moduleName}`)
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

  console.error('🔍 开始分析需要编译的模块...\n')

  // 任务一和任务二：遍历modulesInfosDetail对象
  Object.entries(modulesInfosDetail).forEach(
    ([projectPath, modulesInfos]: [string, ModuleInfo[]]) => {
      if (modulesInfos.length === 0) {
        console.error(`⏭️  项目 ${projectPath} 没有变更的模块，跳过\n`)
        return
      }

      console.error(`📂 项目路径: ${projectPath}`)
      console.error(`📦 检测到 ${modulesInfos.length} 个变更的模块:`)
      modulesInfos.forEach((m) => {
        console.error(`   - ${m.moduleName}`)
      })

      // 任务三：分析依赖关系并找出所有需要编译的模块
      try {
        // 获取该项目所有包的依赖信息
        const dependencyMap = getAllPackageDependencies(projectPath)

        if (dependencyMap.size === 0) {
          console.error(`⚠️  未找到任何包依赖信息，仅编译变更的模块`)
          result[projectPath] = modulesInfos.map(
            (m): BuildedModule => ({
              moduleName: m.moduleName,
              modulePath: m.modulePath,
              reason: 'changed'
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

          console.error(
            `\n✅ 共需编译 ${sortedModules.length} 个模块（包含依赖）:`
          )
          sortedModules.forEach((m, index) => {
            const reasonText =
              m.reason === 'changed'
                ? '直接变更'
                : `被依赖 (${m.dependedBy?.join(', ') ?? ''})`
            console.error(`   ${index + 1}. ${m.moduleName} - ${reasonText}`)
          })
        }
      } catch (error) {
        console.error(
          `❌ 分析项目 ${projectPath} 时出错:`,
          error instanceof Error ? error.message : error
        )
        // 出错时降级为仅编译变更的模块
        result[projectPath] = modulesInfos.map(
          (m): BuildedModule => ({
            moduleName: m.moduleName,
            modulePath: m.modulePath,
            reason: 'changed'
          })
        )
      }

      console.error('\n' + '='.repeat(80) + '\n')
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
  executeCallback(false)

  const buildedModules = getBuildedModules()
  const modules = Object.values(buildedModules).flat()

  // 更新缓存
  cachedBuildModules = modules
  executeCallback(true)
  return modules
}

/**
 * 获取缓存的编译模块列表
 * @returns 缓存的模块列表
 */
function getCachedBuildModules(): BuildedModule[] {
  return cachedBuildModules
}

/**
 * 设置 isReady 状态
 * 当状态变为 true 时，会触发所有注册的回调函数
 * @param value - 新的状态值
 */
function executeCallback(value: boolean): void {
  const oldValue = isReady
  isReady = value

  // 只有当状态变为 true 时，才触发回调
  if (value) {
    console.error('✅ 所有模块编译完成，触发回调...')
    try {
      callback()
    } catch (error) {
      console.error('执行编译完成回调时出错:', error)
    }
  }
}

/**
 * 执行模块编译
 * 遍历缓存的全局变量进行编译
 * 只有当 isReady 为 true 时才会执行
 * @returns 编译是否成功执行
 */
export function buildModules(): boolean {
  if (!isReady) {
    console.error('⚠️  isReady 为 false，跳过编译操作')
    return false
  }

  const modules = getCachedBuildModules()

  if (modules.length === 0) {
    console.error('ℹ️  没有需要编译的模块')
    return true
  }

  console.error(`\n🔨 开始编译 ${modules.length} 个模块...\n`)

  modules.forEach((module, index) => {
    const reasonText =
      module.reason === 'changed'
        ? '直接变更'
        : `被依赖 (${module.dependedBy?.join(', ') ?? ''})`

    console.error(
      `[${index + 1}/${modules.length}] 编译模块: ${module.moduleName}`
    )
    console.error(`   路径: ${module.modulePath}`)
    console.error(`   原因: ${reasonText}`)

    // TODO: 在这里添加实际的编译逻辑
    // 例如：执行 pnpm build 或其他构建命令

    console.error(`   ✅ 编译完成\n`)
  })

  console.error('🎉 所有模块编译完成！\n')

  return true
}

/**
 * 初始化编译监听器
 * 自动注册 isReady 监听，当变为 true 时执行编译
 */
export function initListener(): void {
  console.error('📡 初始化编译监听器...')
  callback = () => {
    console.error('🔔 检测到 isReady 变为 true，开始执行编译...')
    buildModules()
  }

  console.error('✅ 编译监听器初始化完成\n')
}

// 模块加载时自动初始化监听器
initListener()
