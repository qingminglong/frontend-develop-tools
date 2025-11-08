import {
  NODE_DIRS,
  PACKAGE_MANAGER_COMMANDS,
  DEPENDENCY_MESSAGES,
  FILE_OPERATION_MESSAGES,
  PNPM_MODULE_MESSAGES
} from '../consts/index.ts'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { logToChat, formatMessage } from './logger.ts'

/**
 * 检查并安装项目依赖
 * @param projectPath - 项目路径
 * @returns 是否成功
 */
export function ensureProjectDependencies(projectPath: string): boolean {
  try {
    const nodeModulesPath = path.join(projectPath, NODE_DIRS.NODE_MODULES)

    // 检查 node_modules 是否存在且不为空
    if (
      !fs.existsSync(nodeModulesPath) ||
      fs.readdirSync(nodeModulesPath).length === 0
    ) {
      logToChat(
        formatMessage(DEPENDENCY_MESSAGES.MISSING_DEPENDENCIES, {
          path: projectPath
        })
      )
      execSync(PACKAGE_MANAGER_COMMANDS.PNPM_INSTALL, {
        cwd: projectPath,
        stdio: 'inherit',
        encoding: 'utf8'
      })
      logToChat(DEPENDENCY_MESSAGES.DEPENDENCIES_INSTALLED)
      return true
    }

    logToChat(DEPENDENCY_MESSAGES.DEPENDENCIES_EXIST)
    return true
  } catch (error) {
    logToChat(
      DEPENDENCY_MESSAGES.INSTALL_FAILED,
      error instanceof Error ? error.message : String(error)
    )
    return false
  }
}

/**
 * 拷贝目录内容
 * @param srcDir - 源目录
 * @param destDir - 目标目录
 */
export function copyDirectory(srcDir: string, destDir: string): void {
  if (!fs.existsSync(srcDir)) {
    logToChat(
      formatMessage(FILE_OPERATION_MESSAGES.SOURCE_DIR_NOT_EXIST, {
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
 * 查找 .pnpm 目录中的模块路径
 * @param nodeModulesPath - node_modules 路径
 * @param moduleName - 模块名称 (如 @scope/package-name)
 * @returns 目标路径或 null
 */
export function findPnpmModulePath(
  nodeModulesPath: string,
  moduleName: string
): string | null {
  try {
    const pnpmPath = path.join(nodeModulesPath, NODE_DIRS.PNPM_DIR)

    if (!fs.existsSync(pnpmPath)) {
      logToChat(
        formatMessage(PNPM_MODULE_MESSAGES.PNPM_DIR_NOT_FOUND, {
          path: pnpmPath
        })
      )
      return null
    }

    // 将 @scope/package-name 拆分并转换为 @scope+package-name
    const moduleNames = moduleName.split('/')
    const projectModulesName = moduleNames.join('+')

    logToChat(
      formatMessage(PNPM_MODULE_MESSAGES.SEARCHING_MODULE, {
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
        formatMessage(PNPM_MODULE_MESSAGES.PNPM_DIR_NOT_MATCHED, {
          prefix: projectModulesName
        })
      )
      return null
    }

    logToChat(
      formatMessage(PNPM_MODULE_MESSAGES.PNPM_DIR_FOUND, {
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
          formatMessage(PNPM_MODULE_MESSAGES.TARGET_DIR_NOT_EXIST, {
            path: targetPath
          })
        )
        return null
      }
    }

    logToChat(
      formatMessage(PNPM_MODULE_MESSAGES.TARGET_PATH_FOUND, {
        path: targetPath
      })
    )
    return targetPath
  } catch (error) {
    logToChat(
      PNPM_MODULE_MESSAGES.FIND_MODULE_FAILED,
      error instanceof Error ? error.message : String(error)
    )
    return null
  }
}
