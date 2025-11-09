import { configuration } from './get-configuration.ts'
import { logToChat, formatMessage } from '../utils/index.ts'
import { syncCompiledFiles } from '../utils/sync.ts'
import {
  FILE_NAMES,
  ENCODINGS,
  PACKAGE_FIELDS,
  BUILD_COMMANDS,
  TIMEOUTS
} from '../consts/index.ts'
import { SYNC_SINGLE_MODULE_DOMAIN_MESSAGES } from '../consts/sync-single-module.ts'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import type { ModuleInfo } from '../types/detect-changed-module.ts'
import type { BuildedModule } from '../types/build-modules.ts'
import { getWorkspacePackages } from './detect-changed-module.ts'

/**
 * 同步结果类型
 */
export interface SyncResult {
  success: boolean
  partialSuccess: boolean
  message: string
}
/**
 * 全局变量：缓存单个指定模块的信息详情
 * 结构与 modulesInfosDetail 相同
 */
export const singleModulesInfosDetail: Record<string, ModuleInfo[]> = {}

/**
 * 全局变量：缓存单个指定模块的构建列表
 */
let cachedSingleBuildModules: BuildedModule[] = []

/**
 * 重置全局变量
 * 用于清理进程退出或MCP被禁用时的缓存状态
 */
export function resetSyncSingleModuleGlobals(): void {
  // 清空对象的所有属性
  Object.keys(singleModulesInfosDetail).forEach((key) => {
    delete singleModulesInfosDetail[key]
  })
  cachedSingleBuildModules = []
}

/**
 * 列出所有可用的模块名，多个modulePath左右排列显示
 */
export function listAllModules(): void {
  const { modulePaths } = configuration

  if (!modulePaths || modulePaths.length === 0) {
    logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.CONFIG_MODULES_NOT_FOUND)
    return
  }

  logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.LIST_MODULES_TITLE)

  // 收集所有模块信息，按modulePath分组
  const modulesByPath: Record<string, string[]> = {}

  for (const modulePath of modulePaths) {
    try {
      const packages = getWorkspacePackages(modulePath)
      const moduleNames: string[] = []

      for (const pkg of packages) {
        const packageName = getPackageName(pkg.packageJsonPath)
        if (packageName) {
          moduleNames.push(packageName)
        }
      }

      if (moduleNames.length > 0) {
        modulesByPath[modulePath] = moduleNames
      }
    } catch (error) {
      logToChat(
        `   ❌ 处理模块路径 ${modulePath} 时出错:`,
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  const paths = Object.keys(modulesByPath)
  if (paths.length === 0) {
    logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.NO_MODULES_FOUND)
    return
  }

  // 如果只有一个modulePath，直接列出
  if (paths.length === 1) {
    const path = paths[0]
    const modules = modulesByPath[path]

    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.MODULE_PATH_HEADER, {
        path
      })
    )

    modules.forEach((moduleName) => {
      logToChat(`   - ${moduleName}`)
    })
    return
  }

  // 多个modulePath时，左右排列显示
  const maxModulesPerColumn = Math.max(
    ...Object.values(modulesByPath).map((m) => m.length)
  )

  for (let i = 0; i < maxModulesPerColumn; i++) {
    let line = ''

    paths.forEach((path, pathIndex) => {
      const modules = modulesByPath[path]
      const moduleName = modules[i]

      if (pathIndex === 0) {
        // 第一个路径显示标题
        if (i === 0) {
          line += formatMessage(
            SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.MODULE_PATH_HEADER,
            {
              path
            }
          )
        } else {
          line += ' '.repeat(path.length + 4) // 调整对齐，考虑 emoji 和格式
        }
      } else {
        // 后续路径显示标题
        if (i === 0) {
          line +=
            '  ' +
            formatMessage(
              SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.MODULE_PATH_HEADER,
              {
                path
              }
            )
        } else {
          line += '  ' + ' '.repeat(path.length + 4) // 调整对齐
        }
      }

      if (moduleName) {
        if (pathIndex === 0) {
          line += `   - ${moduleName}`
        } else {
          line += `   - ${moduleName}`
        }
      }
    })

    logToChat(line)
  }
}

/**
 * 从package.json中读取name属性
 * @param packageJsonPath - package.json文件路径
 * @returns package.json的name属性
 */
function getPackageName(packageJsonPath: string): string | null {
  try {
    const content = fs.readFileSync(packageJsonPath, ENCODINGS.UTF8)
    const pkg = JSON.parse(content)
    return pkg[PACKAGE_FIELDS.NAME] || null
  } catch (error) {
    logToChat(
      formatMessage(
        SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.PACKAGE_JSON_READ_FAILED,
        {
          path: packageJsonPath
        }
      )
    )
    return null
  }
}

/**
 * 在 configuration.modulePaths 中查找指定模块
 * @param moduleName - 模块名（如 @ida/ui）
 * @returns 找到的模块信息，如果未找到返回 null
 */
function findModuleInConfiguration(moduleName: string): ModuleInfo | null {
  const { modulePaths } = configuration

  if (!modulePaths || modulePaths.length === 0) {
    logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.CONFIG_MODULES_NOT_FOUND)
    return null
  }

  // 遍历每个模块路径
  for (const modulePath of modulePaths) {
    try {
      // 获取该路径下的所有工作区包
      const packages = getWorkspacePackages(modulePath)

      if (packages.length === 0) {
        logToChat(
          formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SKIP_MODULE_PATH, {
            path: modulePath
          })
        )
        continue
      }

      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.PACKAGES_FOUND, {
          path: modulePath,
          count: packages.length
        })
      )

      // 在所有包中查找匹配的模块
      for (const pkg of packages) {
        const packageName = getPackageName(pkg.packageJsonPath)

        if (!packageName) {
          continue
        }

        // 大小写不敏感比较
        if (packageName.toLowerCase() === moduleName.toLowerCase()) {
          logToChat(
            formatMessage(
              SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.MODULE_MATCH_FOUND,
              {
                packageName,
                path: pkg.path
              }
            )
          )
          return {
            moduleName: packageName,
            modulePath: pkg.path
          }
        }
      }
    } catch (error) {
      logToChat(
        `   ❌ 处理模块路径 ${modulePath} 时出错:`,
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  return null
}

/**
 * 将多个模块信息存入全局变量 singleModulesInfosDetail
 * @param moduleInfos - 模块信息数组
 */
function cacheMultipleModuleInfo(moduleInfos: ModuleInfo[]): void {
  // 按项目路径分组模块
  const modulesByProject: Record<string, ModuleInfo[]> = {}

  for (const moduleInfo of moduleInfos) {
    const projectPath = path.dirname(path.dirname(moduleInfo.modulePath))
    if (!modulesByProject[projectPath]) {
      modulesByProject[projectPath] = []
    }
    modulesByProject[projectPath].push(moduleInfo)
  }

  // 清空之前的所有缓存
  Object.keys(singleModulesInfosDetail).forEach((key) => {
    delete singleModulesInfosDetail[key]
  })

  // 缓存新的模块信息
  for (const [projectPath, modules] of Object.entries(modulesByProject)) {
    singleModulesInfosDetail[projectPath] = modules

    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.CACHE_PROJECT_PATH, {
        path: projectPath
      })
    )
    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.CACHE_MODULES_COUNT, {
        count: modules.length
      })
    )

    for (const module of modules) {
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.CACHE_MODULE_NAME, {
          moduleName: module.moduleName
        })
      )
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.CACHE_MODULE_PATH, {
          path: module.modulePath
        })
      )
    }
  }

  logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.MODULES_CACHED)
}

/**

/**
 * 同步 UMD 文件到项目中的匹配位置
 * @param modulePath - 模块路径
 * @param moduleName - 模块名称
 * @param projectPaths - 项目路径列表
 * @returns 拷贝的目录数量
 */

/**

/**
 * 构建单个指定模块
 * @returns 构建结果对象
 */
function buildSingleModule(): {
  success: boolean
  partialSuccess: boolean
  message: string
} {
  try {
    // 获取所有缓存的模块信息
    const allModules = Object.values(singleModulesInfosDetail).flat()

    if (allModules.length === 0) {
      logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.NO_MODULES_TO_BUILD)
      return {
        success: false,
        partialSuccess: false,
        message: '没有需要编译的模块'
      }
    }

    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_MODULES_START, {
        count: allModules.length
      })
    )

    let successCount = 0
    let failCount = 0

    // 清空缓存的构建模块列表
    cachedSingleBuildModules = []

    for (const module of allModules) {
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILDING_MODULE, {
          total: allModules.length,
          moduleName: module.moduleName
        })
      )
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.MODULE_PATH, {
          path: module.modulePath
        })
      )

      try {
        // 检查是否存在 package.json 和 build 脚本
        const packageJsonPath = path.join(
          module.modulePath,
          FILE_NAMES.PACKAGE_JSON
        )

        if (!fs.existsSync(packageJsonPath)) {
          logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.PACKAGE_JSON_NOT_FOUND)
          continue
        }

        const content = fs.readFileSync(packageJsonPath, ENCODINGS.UTF8)
        const pkg = JSON.parse(content)

        if (!pkg.scripts || !pkg.scripts.build) {
          logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_SCRIPT_NOT_FOUND)
          continue
        }

        // 执行 pnpm run build 命令
        logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_COMMAND)

        const startTime = Date.now()

        execSync(BUILD_COMMANDS.PNPM_RUN_BUILD, {
          cwd: module.modulePath,
          stdio: 'inherit', // 将编译输出直接显示在控制台
          encoding: 'utf8',
          timeout: TIMEOUTS.BUILD_TIMEOUT // 10分钟超时
        })

        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        logToChat(
          formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_SUCCESS, {
            duration
          })
        )
        successCount++

        // 添加到缓存的构建模块列表
        cachedSingleBuildModules.push({
          moduleName: module.moduleName,
          modulePath: module.modulePath,
          reason: 'changed'
        })
      } catch (error) {
        logToChat(
          SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_FAILED,
          error instanceof Error ? error.message : String(error)
        )
        logToChat('\n')
        failCount++
      }
    }

    logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_STATS)
    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_SUCCESS_COUNT, {
        count: successCount
      })
    )
    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_FAIL_COUNT, {
        count: failCount
      })
    )
    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_TOTAL_COUNT, {
        count: allModules.length
      })
    )

    // 根据编译结果返回状态
    if (failCount > 0) {
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_PARTIAL_FAIL, {
          count: failCount
        })
      )
      const message = `编译完成，但有 ${failCount} 个模块编译失败，成功 ${successCount} 个`
      return { success: false, partialSuccess: successCount > 0, message }
    }

    logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_ALL_SUCCESS)
    return { success: true, partialSuccess: false, message: '' }
  } catch (error) {
    logToChat(
      SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_EXCEPTION,
      error instanceof Error ? error.message : String(error)
    )
    return {
      success: false,
      partialSuccess: false,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * 获取缓存的单个模块信息详情
 * @returns 缓存的模块信息
 */
export function getSingleModulesInfosDetail(): Record<string, ModuleInfo[]> {
  return singleModulesInfosDetail
}

/**
 * 清空单个模块的缓存
 */
export function clearSingleModulesInfosDetail(): void {
  Object.keys(singleModulesInfosDetail).forEach((key) => {
    delete singleModulesInfosDetail[key]
  })
  cachedSingleBuildModules = []
}

/**
 * 同步指定模块的修改代码
 * 根据模块名数组查找模块，然后执行构建和同步
 * @param modules - 模块名数组
 * @returns 同步结果对象
 */
export function syncSingleModule(modules: string[]): SyncResult {
  try {
    logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SYNC_START)

    if (modules.length === 0) {
      return {
        success: false,
        partialSuccess: false,
        message: '没有指定要同步的模块'
      }
    }

    logToChat(
      formatMessage(
        SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.PROCESSING_MODULES_START,
        {
          count: modules.length
        }
      )
    )

    // 1. 查找所有模块信息
    const foundModules: ModuleInfo[] = []
    const notFoundModules: string[] = []

    for (const moduleName of modules) {
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SEARCHING_MODULE, {
          moduleName
        })
      )

      const moduleInfo = findModuleInConfiguration(moduleName)
      if (moduleInfo) {
        foundModules.push(moduleInfo)
        logToChat(
          formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.MODULE_FOUND, {
            moduleName,
            path: moduleInfo.modulePath
          })
        )
      } else {
        notFoundModules.push(moduleName)
        logToChat(
          formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.MODULE_NOT_FOUND, {
            moduleName
          })
        )
      }
    }

    if (foundModules.length === 0) {
      return {
        success: false,
        partialSuccess: false,
        message: `未找到任何有效的模块。未找到的模块: ${notFoundModules.join(
          ', '
        )}`
      }
    }

    // 2. 缓存所有找到的模块信息
    cacheMultipleModuleInfo(foundModules)

    // 3. 执行模块编译
    const buildResult = buildSingleModule()
    if (!buildResult.success) {
      const message =
        notFoundModules.length > 0
          ? `构建失败。此外，未找到的模块: ${notFoundModules.join(', ')}`
          : '构建失败'
      return {
        success: false,
        partialSuccess: false,
        message
      }
    }

    // 4. 同步编译后的文件
    const isSyncSuccess = syncCompiledFiles(
      cachedSingleBuildModules,
      SYNC_SINGLE_MODULE_DOMAIN_MESSAGES
    )

    if (!isSyncSuccess) {
      const message =
        notFoundModules.length > 0
          ? `同步失败。此外，未找到的模块: ${notFoundModules.join(', ')}`
          : '同步失败'
      return {
        success: false,
        partialSuccess: false,
        message
      }
    }

    // 5. 生成最终结果消息
    let message = SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SYNC_SUCCESS
    const warnings: string[] = []

    if (buildResult.partialSuccess) {
      warnings.push(`构建部分成功: ${buildResult.message}`)
    }

    if (notFoundModules.length > 0) {
      warnings.push(`未找到的模块: ${notFoundModules.join(', ')}`)
    }

    if (warnings.length > 0) {
      message += '\n' + warnings.join('\n')
    }

    logToChat(message)

    return {
      success: true,
      partialSuccess: buildResult.partialSuccess || notFoundModules.length > 0,
      message: warnings.length > 0 ? warnings.join('\n') : ''
    }
  } catch (error) {
    logToChat(
      SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SYNC_EXCEPTION,
      error instanceof Error ? error.message : String(error)
    )
    return {
      success: false,
      partialSuccess: false,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}
