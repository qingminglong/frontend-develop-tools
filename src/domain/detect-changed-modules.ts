import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import yaml from 'js-yaml'
import { glob } from 'glob'
import type {
  ModuleInfo,
  WorkspacePackage,
  WorkspaceConfig
} from '../types/detect-changed-modules.ts'
import {
  FILE_NAMES,
  ENCODINGS,
  PACKAGE_FIELDS,
  GIT_COMMANDS,
  SPECIAL_CHARS,
  ERROR_MESSAGES,
  LOG_MESSAGES
} from '../consts/index.ts'

// 按项目路径缓存模块信息详情
export const modulesInfosDetail: Record<string, ModuleInfo[]> = {}

/**
 * 从modulesPath下获取所有工作区包的信息
 * @param modulePath - 项目根目录路径
 * @returns 包信息数组
 */
function getWorkspacePackages(modulePath: string): WorkspacePackage[] {
  const workspaceFile = path.join(modulePath, FILE_NAMES.WORKSPACE_CONFIG)
  // 如果不存在workspace文件，返回空数组
  if (!fs.existsSync(workspaceFile)) {
    return []
  }
  const content = fs.readFileSync(workspaceFile, ENCODINGS.UTF8)
  const config = yaml.load(content) as WorkspaceConfig
  const packages: WorkspacePackage[] = []

  config[PACKAGE_FIELDS.PACKAGES].forEach((pattern: string) => {
    // 跳过排除模式
    if (pattern.startsWith(SPECIAL_CHARS.EXCLAMATION)) {
      return
    }
    // 解析glob pattern
    const matches = glob.globSync(pattern, {
      cwd: modulePath,
      absolute: false
    })
    matches.forEach((match) => {
      const packagePath = path.join(modulePath, match)
      const srcPath = path.join(packagePath, FILE_NAMES.SRC_DIR)
      const packageJsonPath = path.join(packagePath, FILE_NAMES.PACKAGE_JSON)
      // 检查是否存在src目录和package.json
      if (fs.existsSync(srcPath) && fs.existsSync(packageJsonPath)) {
        packages.push({
          name: match,
          path: packagePath,
          srcPath: srcPath,
          packageJsonPath: packageJsonPath
        })
      }
    })
  })
  return packages
}

/**
 * 获取git变更文件
 * @param modulePath - 项目根目录路径
 * @returns 变更文件数组
 */
function getChangedFiles(modulePath: string): string[] {
  try {
    // 切换到项目根目录执行git命令
    const unstagedFiles = execSync(GIT_COMMANDS.DIFF_NAME_ONLY, {
      encoding: ENCODINGS.UTF8,
      cwd: modulePath
    })
      .split(SPECIAL_CHARS.NEWLINE)
      .filter(Boolean)
    const stagedFiles = execSync(GIT_COMMANDS.DIFF_CACHED_NAME_ONLY, {
      encoding: ENCODINGS.UTF8,
      cwd: modulePath
    })
      .split(SPECIAL_CHARS.NEWLINE)
      .filter(Boolean)
    const untrackedFiles = execSync(GIT_COMMANDS.LS_FILES_UNTRACKED, {
      encoding: ENCODINGS.UTF8,
      cwd: modulePath
    })
      .split(SPECIAL_CHARS.NEWLINE)
      .filter(Boolean)
    return [...new Set([...unstagedFiles, ...stagedFiles, ...untrackedFiles])]
  } catch (error) {
    console.error(
      `获取git变更文件失败: ${
        error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR
      }`
    )
    return []
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
    console.error(`读取${FILE_NAMES.PACKAGE_JSON}失败: ${packageJsonPath}`)
    return null
  }
}

/**
 * 分析受影响的模块
 * @param changedFiles - 变更文件列表
 * @param packages - 工作区包列表
 * @param modulePath - 项目根目录路径
 * @returns 受影响的模块信息数组
 */
function analyzeChangedModules(
  changedFiles: string[],
  packages: WorkspacePackage[],
  modulePath: string
): ModuleInfo[] {
  const affectedModulesMap = new Map<string, ModuleInfo>()

  changedFiles.forEach((file) => {
    const absolutePath = path.join(modulePath, file)
    // 检查文件是否在某个包中
    const matchedPackage = packages.find((pkg) => {
      // 检查文件是否在包的目录下
      const relPath = path.relative(pkg.path, absolutePath)
      return !relPath.startsWith('..') && !path.isAbsolute(relPath)
    })

    if (matchedPackage) {
      // 读取package.json获取name
      const packageName = getPackageName(matchedPackage.packageJsonPath)
      if (packageName && !affectedModulesMap.has(packageName)) {
        affectedModulesMap.set(packageName, {
          moduleName: packageName,
          modulePath: matchedPackage.path
        })
      }
    }
  })

  return Array.from(affectedModulesMap.values())
}
/**
 * 检测并缓存变更的模块信息
 * @param modulePath - 项目根目录路径
 * @returns 变更的模块信息数组
 */
export function detectAndCacheChangedModules(modulePath: string): ModuleInfo[] {
  // 获取所有工作区包
  const packages = getWorkspacePackages(modulePath)
  if (packages.length === 0) {
    console.error(ERROR_MESSAGES.NO_WORKSPACE_PACKAGES)
    // 更新缓存为空
    modulesInfosDetail[modulePath] = []
    return []
  }
  // 获取git变更文件
  const changedFiles = getChangedFiles(modulePath)
  if (changedFiles.length === 0) {
    console.error(ERROR_MESSAGES.NO_FILE_CHANGES)
    // 更新缓存为空
    modulesInfosDetail[modulePath] = []
    return []
  }
  // 分析受影响的模块
  const affectedModules = analyzeChangedModules(
    changedFiles,
    packages,
    modulePath
  )
  // 更新全局缓存（最新一次检测结果）
  modulesInfosDetail[modulePath] = []

  // 更新按项目路径的缓存（支持多项目）
  modulesInfosDetail[modulePath].push(...affectedModules)

  console.error(
    LOG_MESSAGES.MODULES_DETECTED.replace(
      '{count}',
      String(affectedModules.length)
    )
  )
  affectedModules.forEach((m) => {
    console.error(`   - ${m.moduleName} (${m.modulePath})`)
  })

  return modulesInfosDetail[modulePath]
}

/**
 * 获取指定项目路径的模块信息
 * @param modulePath - 项目根目录路径
 * @returns 该项目的模块信息数组，如果不存在则返回空数组
 */
export function getModulesInfosByPath(modulePath: string): ModuleInfo[] {
  return modulesInfosDetail[modulePath] || []
}

/**
 * 获取所有项目的模块信息
 * @returns 所有项目的模块信息详情对象
 */
export function getAllModulesInfosDetail(): Record<string, ModuleInfo[]> {
  return modulesInfosDetail
}

/**
 * 清除指定项目的模块信息缓存
 * @param modulePath - 项目根目录路径
 */
export function clearModulesInfosByPath(modulePath: string): void {
  delete modulesInfosDetail[modulePath]
}

/**
 * 清除所有项目的模块信息缓存
 */
export function clearAllModulesInfos(): void {
  Object.keys(modulesInfosDetail).forEach((key) => {
    modulesInfosDetail[key].length = 0
    delete modulesInfosDetail[key]
  })
}
