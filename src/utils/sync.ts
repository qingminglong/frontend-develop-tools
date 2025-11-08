import fs from 'fs'
import path from 'path'
import {
  UMD_DIRS,
  UMD_SYNC_MESSAGES,
  SCRIPT_FILES,
  SCRIPTS_DIRS
} from '../consts/index.ts'
import { logToChat } from './index.ts'
import { formatMessage } from './index.ts'

/**
 * 同步 UMD 文件到指定项目路径
 * @param modulePath - 模块路径
 * @param moduleName - 模块名称
 * @param projectPaths - 项目路径列表
 * @returns 拷贝的目录数量
 */
export function syncUmdFiles(
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
        formatMessage(UMD_SYNC_MESSAGES.UMD_DIR_NOT_FOUND, {
          moduleName
        })
      )
      return 0
    }

    logToChat(
      formatMessage(UMD_SYNC_MESSAGES.UMD_DIR_FOUND, {
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
      formatMessage(UMD_SYNC_MESSAGES.UMD_FILES_FOUND, {
        count: allUmdFiles.length
      })
    )
    allUmdFiles.forEach((file) =>
      logToChat(
        formatMessage(UMD_SYNC_MESSAGES.UMD_FILE_ITEM, {
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
        formatMessage(UMD_SYNC_MESSAGES.POSTINSTALL_NOT_FOUND, {
          path: postinstallPath
        })
      )
      return 0
    }

    // 4. 读取 postinstall.js 文件内容
    const postinstallContent = fs.readFileSync(postinstallPath, 'utf8')

    if (!postinstallContent || postinstallContent.trim().length === 0) {
      logToChat(UMD_SYNC_MESSAGES.POSTINSTALL_EMPTY)
      return 0
    }

    // 5. 确定目标路径（优先匹配 public/umd/render）
    let targetSubPath = 'public/umd'
    if (postinstallContent.includes('public/umd/render')) {
      targetSubPath = 'public/umd/render'
      logToChat(UMD_SYNC_MESSAGES.UMD_DETECT_RENDER)
    } else if (postinstallContent.includes('public/umd')) {
      targetSubPath = 'public/umd'
      logToChat(UMD_SYNC_MESSAGES.UMD_DETECT_PUBLIC)
    } else {
      logToChat(UMD_SYNC_MESSAGES.UMD_KEYWORD_NOT_FOUND)
      return 0
    }

    // 6. 遍历每个项目路径，拷贝 UMD 文件
    for (const projectPath of projectPaths) {
      try {
        const targetDir = path.join(projectPath, targetSubPath)

        logToChat(
          formatMessage(UMD_SYNC_MESSAGES.UMD_PREPARE_COPY, { path: targetDir })
        )

        // 确保目标目录存在
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true })
          logToChat(
            formatMessage(UMD_SYNC_MESSAGES.UMD_CREATE_DIR, { path: targetDir })
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
              formatMessage(UMD_SYNC_MESSAGES.UMD_FILE_COPY_FAILED, {
                fileName
              }),
              error instanceof Error ? error.message : String(error)
            )
          }
        }

        if (filescopied > 0) {
          logToChat(
            formatMessage(UMD_SYNC_MESSAGES.UMD_DIR_COPIED, {
              destPath: targetDir,
              count: filescopied
            })
          )
          copiedDirCount++
        }
      } catch (error) {
        logToChat(
          formatMessage(UMD_SYNC_MESSAGES.COPY_TO_PROJECT_FAILED, {
            path: projectPath
          }),
          error instanceof Error ? error.message : String(error)
        )
      }
    }
  } catch (error) {
    logToChat(
      UMD_SYNC_MESSAGES.UMD_FILE_COPY_FAILED,
      error instanceof Error ? error.message : String(error)
    )
  }

  return copiedDirCount
}
