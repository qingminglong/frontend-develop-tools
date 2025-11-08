import fs from 'fs'
import path from 'path'
import {
  buildDesignModules as buildModules,
  getCachedStaticBuildModules
} from './build-design-modules.ts'
import { syncUmdFiles } from '../utils/sync.ts'
import { configuration, logProjectPaths } from './get-configuration.ts'
import {
  logToChat,
  formatMessage,
  ensureProjectDependencies,
  copyDirectory,
  findPnpmModulePath
} from '../utils/index.ts'
import {
  NODE_DIRS,
  BUILD_OUTPUT_DIRS,
  UMD_SKIP_CHECK_FILES
} from '../consts/index.ts'
import {
  SYNC_DESIGN_MODULE_MESSAGES,
  SYNC_DESIGN_MODULE_DOMAIN_MESSAGES
} from '../consts/sync-design-module.ts'

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

/**
 * 同步编译后的静态资源文件到项目依赖中
 * @returns 是否成功
 */
function syncModule(): boolean {
  try {
    logToChat(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.SYNC_START)

    // 1. 获取项目路径列表
    if (!logProjectPaths(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES)) {
      return true
    }

    const { projectPaths } = configuration

    // 2. 遍历项目路径，确保依赖已安装
    logToChat(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.CHECK_DEPENDENCIES)
    for (const projectPath of projectPaths) {
      if (!ensureProjectDependencies(projectPath)) {
        logToChat(
          formatMessage(
            SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.DEPENDENCY_CHECK_FAILED,
            {
              path: projectPath
            }
          )
        )
        continue
      }
    }

    // 3. 获取需要同步的模块列表（使用 getCachedStaticBuildModules）
    const buildedModules = getCachedStaticBuildModules()

    if (buildedModules.length === 0) {
      logToChat(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.NO_MODULES_TO_SYNC)
      return true
    }

    logToChat(
      formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.MODULES_TO_SYNC, {
        count: buildedModules.length
      })
    )
    buildedModules.forEach((m) =>
      logToChat(
        formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.MODULE_ITEM, {
          moduleName: m.moduleName
        })
      )
    )

    // 4. 对每个模块和每个项目进行同步
    logToChat(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.SYNC_FILES_START)

    let syncCount = 0
    let skipCount = 0
    let totalUmdCopied = 0

    for (const module of buildedModules) {
      logToChat(
        formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.PROCESSING_MODULE, {
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
            formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.SKIP_PROJECT, {
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
              formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.COPYING_DIR, {
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
                formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.COPY_SUCCESS, {
                  dirName
                })
              )
              copiedDirs++
            } catch (error) {
              logToChat(
                formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.COPY_FAILED, {
                  dirName
                }),
                error instanceof Error ? error.message : String(error)
              )
            }
          }
        }

        if (copiedDirs > 0) {
          logToChat(
            formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.SYNC_TO_PROJECT, {
              path: projectPath,
              count: copiedDirs
            })
          )
          syncCount++
        } else {
          logToChat(
            formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.NO_DIRS_TO_COPY, {
              path: projectPath
            })
          )
          skipCount++
        }
      }

      // 5. 同步 UMD 文件到项目中的匹配位置
      logToChat(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.UMD_SYNC_START)

      // 过滤掉包含 app.html 和 preview.html 的项目
      const filteredProjectPaths = projectPaths.filter((projectPath) => {
        const shouldSkip = shouldSkipUmdSync(projectPath)
        return !shouldSkip
      })

      if (filteredProjectPaths.length > 0) {
        logToChat(
          formatMessage(
            SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.UMD_FILTERED_PROJECTS,
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
          formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.UMD_SYNC_SUMMARY, {
            count: umdCopiedCount
          })
        )
        totalUmdCopied += umdCopiedCount
      }
    }

    logToChat(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.SYNC_STATISTICS)
    logToChat(
      formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.STAT_SUCCESS, {
        count: syncCount
      })
    )
    logToChat(
      formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.STAT_MODULES, {
        count: buildedModules.length
      })
    )
    logToChat(
      formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.STAT_PROJECTS, {
        count: projectPaths.length
      })
    )
    if (totalUmdCopied > 0) {
      logToChat(
        formatMessage(SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.UMD_SYNC_SUMMARY, {
          count: totalUmdCopied
        })
      )
    }

    return true
  } catch (error) {
    logToChat(
      SYNC_DESIGN_MODULE_DOMAIN_MESSAGES.SYNC_FILES_FAILED,
      error instanceof Error ? error.message : String(error)
    )
    return false
  }
}

/**
 * 同步设计态静态资源文件
 * 将模块路径中的静态资源构建并同步到项目路径中对应的目录
 * @returns 是否成功
 */
export function syncDesignModule(): boolean {
  try {
    logToChat(SYNC_DESIGN_MODULE_MESSAGES.SYNC_START)

    // 调用 buildStaticModules 执行构建
    const isBuildSuccess = buildModules()

    if (!isBuildSuccess) {
      logToChat(SYNC_DESIGN_MODULE_MESSAGES.SYNC_FAILED, '构建过程出现错误')
      return false
    }

    // 同步编译后的文件
    const isSyncSuccess = syncModule()

    if (!isSyncSuccess) {
      logToChat(SYNC_DESIGN_MODULE_MESSAGES.SYNC_FAILED, '文件同步出现错误')
      return false
    }

    logToChat(SYNC_DESIGN_MODULE_MESSAGES.SYNC_SUCCESS)
    return true
  } catch (error) {
    logToChat(
      SYNC_DESIGN_MODULE_MESSAGES.SYNC_ERROR,
      error instanceof Error ? error.message : String(error)
    )
    return false
  }
}
