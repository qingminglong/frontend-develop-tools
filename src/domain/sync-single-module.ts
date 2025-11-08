import { configuration } from './get-configuration.ts'
import {
  logToChat,
  formatMessage,
  ensureProjectDependencies,
  copyDirectory
} from '../utils/index.ts'
import {
  NODE_DIRS,
  BUILD_OUTPUT_DIRS,
  UMD_DIRS,
  UMD_SKIP_CHECK_FILES,
  FILE_NAMES,
  ENCODINGS,
  PACKAGE_FIELDS,
  SCRIPTS_DIRS,
  SCRIPT_FILES,
  BUILD_COMMANDS,
  TIMEOUTS,
  REGEX_PATTERNS
} from '../consts/index.ts'
import { SYNC_SINGLE_MODULE_DOMAIN_MESSAGES } from '../consts/sync-single-module.ts'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import type { ModuleInfo } from '../types/detect-changed-module.ts'
import type { BuildedModule } from '../types/build-modules.ts'
import { getWorkspacePackages } from './detect-changed-module.ts'
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
 * 从用户输入中提取模块名
 * 支持多种格式：
 * - "同步@ida/ui模块下修改内容"
 * - "同步 @ida/ui 模块下修改内容"
 * - "@ida/ui"
 * @param userInput - 用户输入字符串
 * @returns 提取的模块名，如果未找到返回 null
 */
function extractModuleName(userInput: string): string | null {
  // 正则匹配 @scope/package-name 格式的包名
  const scopedPackageRegex = REGEX_PATTERNS.SCOPED_PACKAGE
  const match = userInput.match(scopedPackageRegex)

  if (match) {
    return match[0]
  }

  // 如果没有匹配到 scoped package，尝试匹配普通包名
  // 例如：lodash、vue 等
  const simplePackageRegex = REGEX_PATTERNS.SIMPLE_PACKAGE
  const simpleMatch = userInput.match(simplePackageRegex)

  if (simpleMatch && simpleMatch[1]) {
    return simpleMatch[1]
  }

  return null
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
 * 将模块信息存入全局变量 singleModulesInfosDetail
 * @param moduleInfo - 模块信息
 */
function cacheModuleInfo(moduleInfo: ModuleInfo): void {
  // 使用项目根路径作为 key（这里使用模块所在的父级目录）
  const projectPath = path.dirname(path.dirname(moduleInfo.modulePath))

  // 初始化或清空该项目的缓存
  singleModulesInfosDetail[projectPath] = [moduleInfo]

  logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.MODULE_CACHED)
  logToChat(
    formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.CACHE_PROJECT_PATH, {
      path: projectPath
    })
  )
  logToChat(
    formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.CACHE_MODULE_NAME, {
      moduleName: moduleInfo.moduleName
    })
  )
  logToChat(
    formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.CACHE_MODULE_PATH, {
      path: moduleInfo.modulePath
    })
  )
}

/**
 * 查找 .pnpm 目录中的模块路径
 * @param nodeModulesPath - node_modules 路径
 * @param moduleName - 模块名称 (如 @scope/package-name)
 * @returns 目标路径或 null
 */
function findPnpmModulePath(
  nodeModulesPath: string,
  moduleName: string
): string | null {
  try {
    const pnpmPath = path.join(nodeModulesPath, NODE_DIRS.PNPM_DIR)

    if (!fs.existsSync(pnpmPath)) {
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.PNPM_DIR_NOT_FOUND, {
          path: pnpmPath
        })
      )
      return null
    }

    // 将 @scope/package-name 拆分并转换为 @scope+package-name
    const moduleNames = moduleName.split('/')
    const projectModulesName = moduleNames.join('+')

    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SEARCHING_MODULE, {
        moduleName,
        prefix: projectModulesName
      })
    )

    // 查找以 projectModulesName 为前缀的目录
    const pnpmDirs = fs.readdirSync(pnpmPath)
    const matchedDir = pnpmDirs.find((dir) =>
      dir.startsWith(projectModulesName)
    )

    if (!matchedDir) {
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.PNPM_DIR_NOT_MATCHED, {
          prefix: projectModulesName
        })
      )
      return null
    }

    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.PNPM_DIR_FOUND, {
        dir: matchedDir
      })
    )

    // 构建目标路径: .pnpm/{matched}/node_modules/@scope/package-name
    let targetPath = path.join(pnpmPath, matchedDir, NODE_DIRS.NODE_MODULES)

    // 逐级查找目录
    for (const namePart of moduleNames) {
      targetPath = path.join(targetPath, namePart)
      if (!fs.existsSync(targetPath)) {
        logToChat(
          formatMessage(
            SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.TARGET_DIR_NOT_EXIST,
            {
              path: targetPath
            }
          )
        )
        return null
      }
    }

    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.TARGET_PATH_FOUND, {
        path: targetPath
      })
    )
    return targetPath
  } catch (error) {
    logToChat(
      SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.FIND_MODULE_FAILED,
      error instanceof Error ? error.message : String(error)
    )
    return null
  }
}

/**
 * 检查项目路径是否应该跳过 UMD 同步
 * 如果项目同时包含 app.html 和 preview.html 文件，则应跳过
 * @param projectPath - 项目路径
 * @returns 是否应该跳过 UMD 同步
 */
function shouldSkipUmdSync(projectPath: string): boolean {
  try {
    const appHtmlPath = path.join(projectPath, UMD_SKIP_CHECK_FILES.APP_HTML)
    const previewHtmlPath = path.join(
      projectPath,
      UMD_SKIP_CHECK_FILES.PREVIEW_HTML
    )

    const hasAppHtml = fs.existsSync(appHtmlPath)
    const hasPreviewHtml = fs.existsSync(previewHtmlPath)

    return hasAppHtml && hasPreviewHtml
  } catch (error) {
    // 如果检查出错，默认不跳过
    return false
  }
}

/**
 * 同步 UMD 文件到项目中的匹配位置
 * @param modulePath - 模块路径
 * @param moduleName - 模块名称
 * @param projectPaths - 项目路径列表
 * @returns 拷贝的目录数量
 */
function syncUmdFiles(
  modulePath: string,
  moduleName: string,
  projectPaths: string[]
): number {
  let copiedDirCount = 0

  try {
    // 1. 检查 dist/umd 目录是否存在
    const umdDir = path.join(modulePath, UMD_DIRS.DIST_DIR, UMD_DIRS.UMD_DIR)

    if (!fs.existsSync(umdDir)) {
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_DIR_NOT_FOUND, {
          moduleName
        })
      )
      return 0
    }

    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_DIR_FOUND, {
        path: umdDir
      })
    )

    // 2. 获取 umd 目录下的所有文件
    const allUmdFiles = fs.readdirSync(umdDir).filter((file) => {
      const filePath = path.join(umdDir, file)
      return fs.statSync(filePath).isFile()
    })

    if (allUmdFiles.length === 0) {
      logToChat('UMD 目录下没有文件')
      return 0
    }

    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_FILES_FOUND, {
        count: allUmdFiles.length
      })
    )
    allUmdFiles.forEach((file) =>
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_FILE_ITEM, {
          fileName: file
        })
      )
    )

    // 3. 检查 scripts/postinstall.js 文件
    const postinstallPath = path.join(
      modulePath,
      SCRIPTS_DIRS.SCRIPTS,
      SCRIPT_FILES.POSTINSTALL
    )

    if (!fs.existsSync(postinstallPath)) {
      logToChat(
        formatMessage(
          SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.POSTINSTALL_NOT_FOUND,
          {
            path: postinstallPath
          }
        )
      )
      return 0
    }

    // 4. 读取 postinstall.js 文件内容
    const postinstallContent = fs.readFileSync(postinstallPath, 'utf8')

    if (!postinstallContent || postinstallContent.trim().length === 0) {
      logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.POSTINSTALL_EMPTY)
      return 0
    }

    // 5. 确定目标路径（优先匹配 public/umd/render）
    let targetSubPath = 'public/umd'
    if (postinstallContent.includes('public/umd/render')) {
      targetSubPath = 'public/umd/render'
      logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_DETECT_RENDER)
    } else if (postinstallContent.includes('public/umd')) {
      targetSubPath = 'public/umd'
      logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_DETECT_PUBLIC)
    } else {
      logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_KEYWORD_NOT_FOUND)
      return 0
    }

    // 6. 遍历每个项目路径，拷贝 UMD 文件
    for (const projectPath of projectPaths) {
      try {
        const targetDir = path.join(projectPath, targetSubPath)

        logToChat(
          formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_PREPARE_COPY, {
            path: targetDir
          })
        )

        // 确保目标目录存在
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true })
          logToChat(
            formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_CREATE_DIR, {
              path: targetDir
            })
          )
        }

        let filescopied = 0

        // 拷贝 umd 目录下的所有文件
        for (const fileName of allUmdFiles) {
          const srcFilePath = path.join(umdDir, fileName)
          const destFilePath = path.join(targetDir, fileName)

          try {
            fs.copyFileSync(srcFilePath, destFilePath)
            filescopied++
          } catch (error) {
            logToChat(
              formatMessage(
                SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_FILE_COPY_FAILED,
                {
                  fileName
                }
              ),
              error instanceof Error ? error.message : String(error)
            )
          }
        }

        if (filescopied > 0) {
          logToChat(
            formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_DIR_COPIED, {
              destPath: targetDir,
              count: filescopied
            })
          )
          copiedDirCount++
        }
      } catch (error) {
        logToChat(
          formatMessage(
            SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.COPY_TO_PROJECT_FAILED,
            {
              path: projectPath
            }
          ),
          error instanceof Error ? error.message : String(error)
        )
      }
    }
  } catch (error) {
    logToChat(
      SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_FILE_COPY_FAILED,
      error instanceof Error ? error.message : String(error)
    )
  }

  return copiedDirCount
}

/**
 * 同步编译后的文件到项目依赖中
 * @returns 是否成功
 */
function syncCompiledFiles(): boolean {
  try {
    logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SYNC_START)

    // 1. 获取项目路径列表
    const { projectPaths } = configuration

    if (!projectPaths || projectPaths.length === 0) {
      logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.NO_PROJECT_PATHS)
      return true
    }

    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.PROJECT_LIST, {
        count: projectPaths.length
      })
    )
    projectPaths.forEach((p) =>
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.PROJECT_ITEM, {
          path: p
        })
      )
    )

    // 2. 遍历项目路径，确保依赖已安装
    logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.CHECK_DEPENDENCIES)
    for (const projectPath of projectPaths) {
      if (!ensureProjectDependencies(projectPath)) {
        logToChat(
          formatMessage(
            SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.DEPENDENCY_CHECK_FAILED,
            {
              path: projectPath
            }
          )
        )
        continue
      }
    }

    // 3. 获取需要同步的模块列表（从缓存中获取）
    const buildedModules = cachedSingleBuildModules

    if (buildedModules.length === 0) {
      logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.NO_MODULES_TO_SYNC)
      return true
    }

    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.MODULES_TO_SYNC, {
        count: buildedModules.length
      })
    )
    buildedModules.forEach((m) =>
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.MODULE_ITEM, {
          moduleName: m.moduleName
        })
      )
    )

    // 4. 对每个模块和每个项目进行同步
    logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SYNC_FILES_START)

    let syncCount = 0
    let skipCount = 0
    let totalUmdCopied = 0

    for (const module of buildedModules) {
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.PROCESSING_MODULE, {
          moduleName: module.moduleName
        })
      )

      for (const projectPath of projectPaths) {
        const nodeModulesPath = path.join(projectPath, NODE_DIRS.NODE_MODULES)

        // 查找目标路径
        const targetPath = findPnpmModulePath(
          nodeModulesPath,
          module.moduleName
        )

        if (!targetPath) {
          logToChat(
            formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SKIP_PROJECT, {
              path: projectPath
            })
          )
          skipCount++
          continue
        }

        // 拷贝 dist、es、lib 目录
        let copiedDirs = 0

        for (const dirName of BUILD_OUTPUT_DIRS) {
          const srcDir = path.join(module.modulePath, dirName)
          const destDir = path.join(targetPath, dirName)

          if (fs.existsSync(srcDir)) {
            logToChat(
              formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.COPYING_DIR, {
                dirName
              })
            )
            try {
              // 删除旧的目标目录
              if (fs.existsSync(destDir)) {
                fs.rmSync(destDir, { recursive: true, force: true })
              }
              copyDirectory(srcDir, destDir)
              logToChat(
                formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.COPY_SUCCESS, {
                  dirName
                })
              )
              copiedDirs++
            } catch (error) {
              logToChat(
                formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.COPY_FAILED, {
                  dirName
                }),
                error instanceof Error ? error.message : String(error)
              )
            }
          }
        }

        if (copiedDirs > 0) {
          logToChat(
            formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SYNC_TO_PROJECT, {
              path: projectPath,
              count: copiedDirs
            })
          )
          syncCount++
        } else {
          logToChat(
            formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.NO_DIRS_TO_COPY, {
              path: projectPath
            })
          )
          skipCount++
        }
      }

      // 5. 同步 UMD 文件到项目中的匹配位置
      logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_SYNC_START)

      // 过滤掉包含 app.html 和 preview.html 的项目
      const filteredProjectPaths = projectPaths.filter((projectPath) => {
        const shouldSkip = shouldSkipUmdSync(projectPath)
        if (shouldSkip) {
          logToChat(
            formatMessage(
              SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_SKIP_PROJECT_WITH_HTML,
              {
                path: projectPath
              }
            )
          )
        }
        return !shouldSkip
      })

      if (filteredProjectPaths.length > 0) {
        logToChat(
          formatMessage(
            SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_FILTERED_PROJECTS,
            {
              count: filteredProjectPaths.length
            }
          )
        )
      }

      const umdCopiedCount = syncUmdFiles(
        module.modulePath,
        module.moduleName,
        filteredProjectPaths
      )

      if (umdCopiedCount > 0) {
        logToChat(
          formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_SYNC_SUMMARY, {
            count: umdCopiedCount
          })
        )
        totalUmdCopied += umdCopiedCount
      }
    }

    logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SYNC_STATISTICS)
    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.STAT_SUCCESS, {
        count: syncCount
      })
    )
    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.STAT_SKIPPED, {
        count: skipCount
      })
    )
    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.STAT_MODULES, {
        count: buildedModules.length
      })
    )
    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.STAT_PROJECTS, {
        count: projectPaths.length
      })
    )
    if (totalUmdCopied > 0) {
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.UMD_SYNC_SUMMARY, {
          count: totalUmdCopied
        })
      )
    }

    return true
  } catch (error) {
    logToChat(
      SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SYNC_FILES_FAILED,
      error instanceof Error ? error.message : String(error)
    )
    return false
  }
}

/**
 * 构建单个指定模块
 * @returns 是否成功
 */
function buildSingleModule(): boolean {
  try {
    // 获取所有缓存的模块信息
    const allModules = Object.values(singleModulesInfosDetail).flat()

    if (allModules.length === 0) {
      logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.NO_MODULES_TO_BUILD)
      return false
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
      return false
    }

    logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_ALL_SUCCESS)
    return true
  } catch (error) {
    logToChat(
      SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.BUILD_EXCEPTION,
      error instanceof Error ? error.message : String(error)
    )
    return false
  }
}

/**
 * 同步指定模块的修改代码
 * 根据用户输入查找模块，然后执行构建和同步
 * @param userInput - 用户输入字符串
 * @returns 同步是否成功执行
 */
export function syncSingleModule(userInput: string): boolean {
  try {
    logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SYNC_START)

    // 1. 从用户输入中提取模块名
    const moduleName = extractModuleName(userInput)

    if (!moduleName) {
      logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.EXTRACT_MODULE_FAILED)
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.USER_INPUT, {
          input: userInput
        })
      )
      logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.EXTRACTION_HINT)
      return false
    }

    logToChat(
      formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.EXTRACT_MODULE_SUCCESS, {
        moduleName
      })
    )

    // 2. 在配置中查找模块
    const moduleInfo = findModuleInConfiguration(moduleName)

    if (!moduleInfo) {
      logToChat(
        formatMessage(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.MODULE_NOT_FOUND, {
          moduleName
        })
      )
      return false
    }

    logToChat('')

    // 3. 将模块信息缓存到全局变量
    cacheModuleInfo(moduleInfo)
    logToChat('')

    // 4. 执行模块编译
    const buildResult = buildSingleModule()

    if (!buildResult) {
      logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SYNC_BUILD_FAILED)
      return false
    }

    // 5. 同步编译后的文件
    const syncResult = syncCompiledFiles()

    if (!syncResult) {
      logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SYNC_FAILED)
      return false
    }

    logToChat(SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SYNC_SUCCESS)
    return true
  } catch (error) {
    logToChat(
      SYNC_SINGLE_MODULE_DOMAIN_MESSAGES.SYNC_EXCEPTION,
      error instanceof Error ? error.message : String(error)
    )
    return false
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
