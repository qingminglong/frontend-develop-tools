import { buildModules, getCachedBuildModules } from './build-modules.ts'
import { configuration } from './get-configuration.ts'
import { logToChat } from '../utils/index.ts'
import {
  NODE_DIRS,
  BUILD_OUTPUT_DIRS,
  PACKAGE_MANAGER_COMMANDS,
  SYNC_MODIFY_MESSAGES
} from '../consts/index.ts'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

/**
 * 替换消息模板中的占位符
 * @param template - 消息模板
 * @param params - 参数对象
 * @returns 替换后的消息
 */
function formatMessage(
  template: string,
  params: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
}

/**
 * 检查并安装项目依赖
 * @param projectPath - 项目路径
 * @returns 是否成功
 */
function ensureProjectDependencies(projectPath: string): boolean {
  try {
    const nodeModulesPath = path.join(projectPath, NODE_DIRS.NODE_MODULES)

    // 检查 node_modules 是否存在且不为空
    if (
      !fs.existsSync(nodeModulesPath) ||
      fs.readdirSync(nodeModulesPath).length === 0
    ) {
      logToChat(
        formatMessage(SYNC_MODIFY_MESSAGES.MISSING_DEPENDENCIES, {
          path: projectPath
        })
      )
      execSync(PACKAGE_MANAGER_COMMANDS.PNPM_INSTALL, {
        cwd: projectPath,
        stdio: 'inherit',
        encoding: 'utf8'
      })
      logToChat(SYNC_MODIFY_MESSAGES.DEPENDENCIES_INSTALLED)
      return true
    }

    logToChat(SYNC_MODIFY_MESSAGES.DEPENDENCIES_EXIST)
    return true
  } catch (error) {
    logToChat(
      SYNC_MODIFY_MESSAGES.INSTALL_FAILED,
      error instanceof Error ? error.message : String(error)
    )
    return false
  }
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
        formatMessage(SYNC_MODIFY_MESSAGES.PNPM_DIR_NOT_FOUND, {
          path: pnpmPath
        })
      )
      return null
    }

    // 将 @scope/package-name 拆分并转换为 @scope+package-name
    const moduleNames = moduleName.split('/')
    const projectModulesName = moduleNames.join('+')

    logToChat(
      formatMessage(SYNC_MODIFY_MESSAGES.SEARCHING_MODULE, {
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
        formatMessage(SYNC_MODIFY_MESSAGES.PNPM_DIR_NOT_MATCHED, {
          prefix: projectModulesName
        })
      )
      return null
    }

    logToChat(
      formatMessage(SYNC_MODIFY_MESSAGES.PNPM_DIR_FOUND, { dir: matchedDir })
    )

    // 构建目标路径: .pnpm/{matched}/node_modules/@scope/package-name
    let targetPath = path.join(pnpmPath, matchedDir, NODE_DIRS.NODE_MODULES)

    // 逐级查找目录
    for (const namePart of moduleNames) {
      targetPath = path.join(targetPath, namePart)
      if (!fs.existsSync(targetPath)) {
        logToChat(
          formatMessage(SYNC_MODIFY_MESSAGES.TARGET_DIR_NOT_EXIST, {
            path: targetPath
          })
        )
        return null
      }
    }

    logToChat(
      formatMessage(SYNC_MODIFY_MESSAGES.TARGET_PATH_FOUND, {
        path: targetPath
      })
    )
    return targetPath
  } catch (error) {
    logToChat(
      SYNC_MODIFY_MESSAGES.FIND_MODULE_FAILED,
      error instanceof Error ? error.message : String(error)
    )
    return null
  }
}

/**
 * 拷贝目录内容
 * @param srcDir - 源目录
 * @param destDir - 目标目录
 */
function copyDirectory(srcDir: string, destDir: string): void {
  if (!fs.existsSync(srcDir)) {
    logToChat(
      formatMessage(SYNC_MODIFY_MESSAGES.SOURCE_DIR_NOT_EXIST, {
        path: srcDir
      })
    )
    return
  }

  // 确保目标目录存在
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name)
    const destPath = path.join(destDir, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * 同步编译后的文件到项目依赖中
 * @returns 是否成功
 */
function syncCompiledFiles(): boolean {
  try {
    logToChat(SYNC_MODIFY_MESSAGES.SYNC_START)

    // 1. 获取项目路径列表
    const { projectPaths } = configuration

    if (!projectPaths || projectPaths.length === 0) {
      logToChat(SYNC_MODIFY_MESSAGES.NO_PROJECT_PATHS)
      return true
    }

    logToChat(
      formatMessage(SYNC_MODIFY_MESSAGES.PROJECT_LIST, {
        count: projectPaths.length
      })
    )
    projectPaths.forEach((p) =>
      logToChat(formatMessage(SYNC_MODIFY_MESSAGES.PROJECT_ITEM, { path: p }))
    )

    // 2. 遍历项目路径，确保依赖已安装
    logToChat(SYNC_MODIFY_MESSAGES.CHECK_DEPENDENCIES)
    for (const projectPath of projectPaths) {
      if (!ensureProjectDependencies(projectPath)) {
        logToChat(
          formatMessage(SYNC_MODIFY_MESSAGES.DEPENDENCY_CHECK_FAILED, {
            path: projectPath
          })
        )
        continue
      }
    }

    // 3. 获取需要同步的模块列表
    const buildedModules = getCachedBuildModules()

    if (buildedModules.length === 0) {
      logToChat(SYNC_MODIFY_MESSAGES.NO_MODULES_TO_SYNC)
      return true
    }

    logToChat(
      formatMessage(SYNC_MODIFY_MESSAGES.MODULES_TO_SYNC, {
        count: buildedModules.length
      })
    )
    buildedModules.forEach((m) =>
      logToChat(
        formatMessage(SYNC_MODIFY_MESSAGES.MODULE_ITEM, {
          moduleName: m.moduleName
        })
      )
    )

    // 4. 对每个模块和每个项目进行同步
    logToChat(SYNC_MODIFY_MESSAGES.SYNC_FILES_START)

    let syncCount = 0
    let skipCount = 0

    for (const module of buildedModules) {
      logToChat(
        formatMessage(SYNC_MODIFY_MESSAGES.PROCESSING_MODULE, {
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
            formatMessage(SYNC_MODIFY_MESSAGES.SKIP_PROJECT, {
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
              formatMessage(SYNC_MODIFY_MESSAGES.COPYING_DIR, { dirName })
            )
            try {
              // 删除旧的目标目录
              if (fs.existsSync(destDir)) {
                fs.rmSync(destDir, { recursive: true, force: true })
              }
              copyDirectory(srcDir, destDir)
              logToChat(
                formatMessage(SYNC_MODIFY_MESSAGES.COPY_SUCCESS, { dirName })
              )
              copiedDirs++
            } catch (error) {
              logToChat(
                formatMessage(SYNC_MODIFY_MESSAGES.COPY_FAILED, { dirName }),
                error instanceof Error ? error.message : String(error)
              )
            }
          }
        }

        if (copiedDirs > 0) {
          logToChat(
            formatMessage(SYNC_MODIFY_MESSAGES.SYNC_TO_PROJECT, {
              path: projectPath,
              count: copiedDirs
            })
          )
          syncCount++
        } else {
          logToChat(
            formatMessage(SYNC_MODIFY_MESSAGES.NO_DIRS_TO_COPY, {
              path: projectPath
            })
          )
          skipCount++
        }
      }
    }

    logToChat(SYNC_MODIFY_MESSAGES.SYNC_STATISTICS)
    logToChat(
      formatMessage(SYNC_MODIFY_MESSAGES.STAT_SUCCESS, { count: syncCount })
    )
    logToChat(
      formatMessage(SYNC_MODIFY_MESSAGES.STAT_SKIPPED, { count: skipCount })
    )
    logToChat(
      formatMessage(SYNC_MODIFY_MESSAGES.STAT_MODULES, {
        count: buildedModules.length
      })
    )
    logToChat(
      formatMessage(SYNC_MODIFY_MESSAGES.STAT_PROJECTS, {
        count: projectPaths.length
      })
    )

    return true
  } catch (error) {
    logToChat(
      SYNC_MODIFY_MESSAGES.SYNC_FILES_FAILED,
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
export function syncModifyCode(): boolean {
  try {
    logToChat(SYNC_MODIFY_MESSAGES.SYNC_MODIFY_START)

    // 调用 buildModules 执行构建
    const buildResult = buildModules()

    if (!buildResult) {
      logToChat(SYNC_MODIFY_MESSAGES.BUILD_FAILED)
      return false
    }

    // 同步编译后的文件
    const syncResult = syncCompiledFiles()

    if (!syncResult) {
      logToChat(SYNC_MODIFY_MESSAGES.FILE_SYNC_FAILED)
      return false
    }

    logToChat(SYNC_MODIFY_MESSAGES.SYNC_MODIFY_SUCCESS)
    return true
  } catch (error) {
    logToChat(
      SYNC_MODIFY_MESSAGES.SYNC_MODIFY_ERROR,
      error instanceof Error ? error.message : String(error)
    )
    return false
  }
}
