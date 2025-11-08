import fs from 'fs'
import path from 'path'
import {
  buildModules,
  getCachedBuildModules,
  getAllBuildedModules
} from './build-modules.ts'
import { configuration } from './get-configuration.ts'
import { syncUmdFiles } from '../utils/sync.ts'
import {
  logToChat,
  formatMessage,
  ensureProjectDependencies,
  copyDirectory,
  findPnpmModulePath
} from '../utils/index.ts'
import { detectChangedModules } from './detect-changed-module.ts'
import {
  NODE_DIRS,
  BUILD_OUTPUT_DIRS,
  UMD_SKIP_CHECK_FILES
} from '../consts/index.ts'
import { SYNC_MODIFIED_MODULE_MESSAGES } from '../consts/sync-modified-module.ts'

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
 * 同步编译后的文件到项目依赖中
 * @returns 是否成功
 */
function syncCompiledFiles(): boolean {
  try {
    logToChat(SYNC_MODIFIED_MODULE_MESSAGES.SYNC_START)

    // 1. 获取项目路径列表
    const { projectPaths } = configuration

    if (!projectPaths || projectPaths.length === 0) {
      logToChat(SYNC_MODIFIED_MODULE_MESSAGES.NO_PROJECT_PATHS)
      return true
    }

    logToChat(
      formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.PROJECT_LIST, {
        count: projectPaths.length
      })
    )
    projectPaths.forEach((p) =>
      logToChat(
        formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.PROJECT_ITEM, { path: p })
      )
    )

    // 2. 遍历项目路径，确保依赖已安装
    logToChat(SYNC_MODIFIED_MODULE_MESSAGES.CHECK_DEPENDENCIES)
    for (const projectPath of projectPaths) {
      if (!ensureProjectDependencies(projectPath)) {
        logToChat(
          formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.DEPENDENCY_CHECK_FAILED, {
            path: projectPath
          })
        )
        continue
      }
    }

    // 3. 获取需要同步的模块列表
    const buildedModules = getCachedBuildModules()

    if (buildedModules.length === 0) {
      logToChat(SYNC_MODIFIED_MODULE_MESSAGES.NO_MODULES_TO_SYNC)
      return true
    }

    logToChat(
      formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.MODULES_TO_SYNC, {
        count: buildedModules.length
      })
    )
    buildedModules.forEach((m) =>
      logToChat(
        formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.MODULE_ITEM, {
          moduleName: m.moduleName
        })
      )
    )

    // 4. 对每个模块和每个项目进行同步
    logToChat(SYNC_MODIFIED_MODULE_MESSAGES.SYNC_FILES_START)

    let syncCount = 0
    let skipCount = 0
    let totalUmdCopied = 0

    for (const module of buildedModules) {
      logToChat(
        formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.PROCESSING_MODULE, {
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
            formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.SKIP_PROJECT, {
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
              formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.COPYING_DIR, {
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
                formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.COPY_SUCCESS, {
                  dirName
                })
              )
              copiedDirs++
            } catch (error) {
              logToChat(
                formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.COPY_FAILED, {
                  dirName
                }),
                error instanceof Error ? error.message : String(error)
              )
            }
          }
        }

        if (copiedDirs > 0) {
          logToChat(
            formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.SYNC_TO_PROJECT, {
              path: projectPath,
              count: copiedDirs
            })
          )
          syncCount++
        } else {
          logToChat(
            formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.NO_DIRS_TO_COPY, {
              path: projectPath
            })
          )
          skipCount++
        }
      }

      // 5. 同步 UMD 文件到项目中的匹配位置
      logToChat(SYNC_MODIFIED_MODULE_MESSAGES.UMD_SYNC_START)

      // 过滤掉包含 app.html 和 preview.html 的项目
      const filteredProjectPaths = projectPaths.filter((projectPath) => {
        const shouldSkip = shouldSkipUmdSync(projectPath)
        if (shouldSkip) {
          logToChat(
            formatMessage(
              SYNC_MODIFIED_MODULE_MESSAGES.UMD_SKIP_PROJECT_WITH_HTML,
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
          formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.UMD_FILTERED_PROJECTS, {
            count: filteredProjectPaths.length
          })
        )
      }

      const umdCopiedCount = syncUmdFiles(
        module.modulePath,
        module.moduleName,
        filteredProjectPaths
      )

      if (umdCopiedCount > 0) {
        logToChat(
          formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.UMD_SYNC_SUMMARY, {
            count: umdCopiedCount
          })
        )
        totalUmdCopied += umdCopiedCount
      }
    }

    logToChat(SYNC_MODIFIED_MODULE_MESSAGES.SYNC_STATISTICS)
    logToChat(
      formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.STAT_SUCCESS, {
        count: syncCount
      })
    )
    logToChat(
      formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.STAT_SKIPPED, {
        count: skipCount
      })
    )
    logToChat(
      formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.STAT_MODULES, {
        count: buildedModules.length
      })
    )
    logToChat(
      formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.STAT_PROJECTS, {
        count: projectPaths.length
      })
    )
    if (totalUmdCopied > 0) {
      logToChat(
        formatMessage(SYNC_MODIFIED_MODULE_MESSAGES.UMD_SYNC_SUMMARY, {
          count: totalUmdCopied
        })
      )
    }

    return true
  } catch (error) {
    logToChat(
      SYNC_MODIFIED_MODULE_MESSAGES.SYNC_FILES_FAILED,
      error instanceof Error ? error.message : String(error)
    )
    return false
  }
}

/**
 * 同步修改代码
 * 在代码修改后同步执行构建任务并同步编译后的文件
 * @returns 同步修改是否成功执行
 */
export function syncModifiedModule(): boolean {
  try {
    logToChat(SYNC_MODIFIED_MODULE_MESSAGES.SYNC_MODIFY_START)

    // 检测变更的模块
    for (const modulePath of configuration.modulePaths) {
      detectChangedModules(modulePath)
    }

    // 获取所有已构建的模块
    getAllBuildedModules()

    // 调用 buildModules 执行构建
    const isSuccess = buildModules()

    if (!isSuccess) {
      logToChat(SYNC_MODIFIED_MODULE_MESSAGES.BUILD_FAILED)
      return false
    }

    // 同步编译后的文件
    const syncResult = syncCompiledFiles()

    if (!syncResult) {
      logToChat(SYNC_MODIFIED_MODULE_MESSAGES.FILE_SYNC_FAILED)
      return false
    }

    logToChat(SYNC_MODIFIED_MODULE_MESSAGES.SYNC_MODIFY_SUCCESS)
    return true
  } catch (error) {
    logToChat(
      SYNC_MODIFIED_MODULE_MESSAGES.SYNC_MODIFY_ERROR,
      error instanceof Error ? error.message : String(error)
    )
    return false
  }
}
