import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import yaml from 'js-yaml'
import { glob } from 'glob'

// 缓存模块名称
export const moduleNames: string[] = []

interface WorkspacePackage {
  name: string
  path: string
  srcPath: string
  packageJsonPath: string
}

interface WorkspaceConfig {
  packages: string[]
}

/**
 * 从modulesPath下获取所有工作区包的信息
 * @param modulePath - 项目根目录路径
 * @returns 包信息数组
 */
function getWorkspacePackages(modulePath: string): WorkspacePackage[] {
  const workspaceFile = path.join(modulePath, 'pnpm-workspace.yaml')

  // 如果不存在workspace文件，返回空数组
  if (!fs.existsSync(workspaceFile)) {
    return []
  }

  const content = fs.readFileSync(workspaceFile, 'utf8')
  const config = yaml.load(content) as WorkspaceConfig
  const packages: WorkspacePackage[] = []

  config.packages.forEach((pattern: string) => {
    // 跳过排除模式
    if (pattern.startsWith('!')) {
      return
    }

    // 解析glob pattern
    const matches = glob.globSync(pattern, {
      cwd: modulePath,
      absolute: false
    })

    matches.forEach((match) => {
      const packagePath = path.join(modulePath, match)
      const srcPath = path.join(packagePath, 'src')
      const packageJsonPath = path.join(packagePath, 'package.json')

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
    const unstagedFiles = execSync('git diff --name-only', {
      encoding: 'utf8',
      cwd: modulePath
    })
      .split('\n')
      .filter(Boolean)

    const stagedFiles = execSync('git diff --cached --name-only', {
      encoding: 'utf8',
      cwd: modulePath
    })
      .split('\n')
      .filter(Boolean)

    const untrackedFiles = execSync(
      'git ls-files --others --exclude-standard',
      {
        encoding: 'utf8',
        cwd: modulePath
      }
    )
      .split('\n')
      .filter(Boolean)

    return [...new Set([...unstagedFiles, ...stagedFiles, ...untrackedFiles])]
  } catch (error) {
    console.error(
      `获取git变更文件失败: ${
        error instanceof Error ? error.message : 'Unknown error'
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
    const content = fs.readFileSync(packageJsonPath, 'utf8')
    const pkg = JSON.parse(content)
    return pkg.name || null
  } catch (error) {
    console.error(`读取package.json失败: ${packageJsonPath}`)
    return null
  }
}

/**
 * 分析受影响的模块
 * @param changedFiles - 变更文件列表
 * @param packages - 工作区包列表
 * @param modulePath - 项目根目录路径
 * @returns 受影响的模块名称集合
 */
function analyzeChangedModules(
  changedFiles: string[],
  packages: WorkspacePackage[],
  modulePath: string
): Set<string> {
  const affectedModules = new Set<string>()

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
      if (packageName) {
        affectedModules.add(packageName)
      }
    }
  })

  return affectedModules
}

/**
 * 检测并缓存变更的模块名称
 * @param modulePath - 项目根目录路径
 * @returns 变更的模块名称数组
 */
export function detectAndCacheChangedModules(modulePath: string): string[] {
  // 清空旧的缓存
  moduleNames.length = 0

  // 获取所有工作区包
  const packages = getWorkspacePackages(modulePath)

  if (packages.length === 0) {
    console.error('未找到任何工作区包')
    return []
  }

  // 获取git变更文件
  const changedFiles = getChangedFiles(modulePath)

  if (changedFiles.length === 0) {
    console.error('未检测到任何文件变更')
    return []
  }

  // 分析受影响的模块
  const affectedModules = analyzeChangedModules(
    changedFiles,
    packages,
    modulePath
  )

  // 更新缓存
  moduleNames.push(...Array.from(affectedModules))

  console.error(
    `📦 检测到 ${affectedModules.size} 个模块发生变更: ${Array.from(
      affectedModules
    ).join(', ')}`
  )

  return moduleNames
}
