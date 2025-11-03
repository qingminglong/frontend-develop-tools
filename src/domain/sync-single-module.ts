import { configuration } from './get-configuration.ts'
import { logToChat } from '../utils/index.ts'
import {
  NODE_DIRS,
  BUILD_OUTPUT_DIRS,
  PACKAGE_MANAGER_COMMANDS,
  SYNC_MODIFY_MESSAGES,
  UMD_DIRS,
  UMD_SKIP_CHECK_FILES,
  FILE_NAMES,
  ENCODINGS,
  PACKAGE_FIELDS,
  SPECIAL_CHARS
} from '../consts/index.ts'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { glob } from 'glob'
import type { ModuleInfo } from '../types/detect-changed-modules.ts'
import type { BuildedModule } from '../types/build-modules.ts'

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
  const scopedPackageRegex = /@[\w-]+\/[\w-]+/
  const match = userInput.match(scopedPackageRegex)

  if (match) {
    return match[0]
  }

  // 如果没有匹配到 scoped package，尝试匹配普通包名
  // 例如：lodash、vue 等
  const simplePackageRegex =
    /(?:同步|模块|修改|内容|\s)*([a-zA-Z][\w-]*?)(?:模块|下修改内容|\s|$)/
  const simpleMatch = userInput.match(simplePackageRegex)

  if (simpleMatch && simpleMatch[1]) {
    return simpleMatch[1]
  }

  return null
}

/**
 * 从workspace路径下获取所有工作区包的信息
 * @param modulePath - 项目根目录路径
 * @returns 包信息数组
 */
function getWorkspacePackages(modulePath: string): Array<{
  name: string
  path: string
  srcPath: string
  packageJsonPath: string
}> {
  const workspaceFile = path.join(modulePath, FILE_NAMES.WORKSPACE_CONFIG)
  // 如果不存在workspace文件，返回空数组
  if (!fs.existsSync(workspaceFile)) {
    logToChat(`   ⚠️ workspace 文件不存在: ${workspaceFile}`)
    return []
  }

  try {
    const content = fs.readFileSync(workspaceFile, ENCODINGS.UTF8)
    const config = yaml.load(content) as { packages: string[] }
    const packages: Array<{
      name: string
      path: string
      srcPath: string
      packageJsonPath: string
    }> = []

    logToChat(
      `   📄 workspace 配置包含 ${
        config[PACKAGE_FIELDS.PACKAGES].length
      } 个 pattern`
    )

    config[PACKAGE_FIELDS.PACKAGES].forEach((pattern: string) => {
      // 跳过排除模式
      if (pattern.startsWith(SPECIAL_CHARS.EXCLAMATION)) {
        logToChat(`   ⏭️  跳过排除模式: ${pattern}`)
        return
      }

      logToChat(`   🔍 解析 pattern: ${pattern}`)

      // 解析glob pattern
      const matches = glob.globSync(pattern, {
        cwd: modulePath,
        absolute: false
      })

      logToChat(`      找到 ${matches.length} 个匹配`)

      matches.forEach((match: string) => {
        const packagePath = path.join(modulePath, match)
        const srcPath = path.join(packagePath, FILE_NAMES.SRC_DIR)
        const packageJsonPath = path.join(packagePath, FILE_NAMES.PACKAGE_JSON)

        const hasSrc = fs.existsSync(srcPath)
        const hasPackageJson = fs.existsSync(packageJsonPath)

        logToChat(
          `      检查 ${match}: src=${hasSrc}, package.json=${hasPackageJson}`
        )

        // 检查是否存在src目录和package.json
        if (hasSrc && hasPackageJson) {
          packages.push({
            name: match,
            path: packagePath,
            srcPath: srcPath,
            packageJsonPath: packageJsonPath
          })
          logToChat(`      ✅ 添加包: ${match}`)
        }
      })
    })

    logToChat(`   📦 总共找到 ${packages.length} 个有效包`)
    return packages
  } catch (error) {
    logToChat(
      `   ⚠️ 解析 workspace 配置失败: ${modulePath}`,
      error instanceof Error ? error.message : String(error)
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
    logToChat(`   ⚠️ 读取 package.json 失败: ${packageJsonPath}`)
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

  console.error(
    '[DEBUG] findModuleInConfiguration 被调用, moduleName=',
    moduleName
  )
  console.error(
    '[DEBUG] configuration.modulePaths=',
    JSON.stringify(modulePaths)
  )

  if (!modulePaths || modulePaths.length === 0) {
    logToChat('⚠️ 配置中未找到模块路径 (modulePaths)')
    return null
  }

  logToChat(`🔍 在 ${modulePaths.length} 个模块路径中查找模块: ${moduleName}`)

  // 遍历每个模块路径
  for (const modulePath of modulePaths) {
    console.error('[DEBUG] 处理 modulePath=', modulePath)
    try {
      // 获取该路径下的所有工作区包
      console.error('[DEBUG] 调用 getWorkspacePackages...')
      const packages = getWorkspacePackages(modulePath)
      console.error(
        '[DEBUG] getWorkspacePackages 返回:',
        packages.length,
        '个包'
      )

      if (packages.length === 0) {
        logToChat(`   ⚠️ 跳过 ${modulePath}: 未找到工作区包`)
        continue
      }

      logToChat(`   📦 在 ${modulePath} 中找到 ${packages.length} 个包`)

      // 在所有包中查找匹配的模块
      for (const pkg of packages) {
        const packageName = getPackageName(pkg.packageJsonPath)

        if (!packageName) {
          continue
        }

        // 大小写不敏感比较
        if (packageName.toLowerCase() === moduleName.toLowerCase()) {
          logToChat(`   ✅ 找到匹配的模块: ${packageName} (路径: ${pkg.path})`)
          return {
            moduleName: packageName,
            modulePath: pkg.path
          }
        }
      }

      logToChat(`   ⚠️ 在 ${modulePath} 中未找到模块: ${moduleName}`)
    } catch (error) {
      logToChat(
        `   ❌ 处理模块路径 ${modulePath} 时出错:`,
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  logToChat(`   ❌ 未找到模块: ${moduleName}`)
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

  logToChat(`📦 模块信息已缓存到全局变量`)
  logToChat(`   项目路径: ${projectPath}`)
  logToChat(`   模块名: ${moduleInfo.moduleName}`)
  logToChat(`   模块路径: ${moduleInfo.modulePath}`)
}

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
        formatMessage(SYNC_MODIFY_MESSAGES.UMD_DIR_NOT_FOUND, { moduleName })
      )
      return 0
    }

    logToChat(
      formatMessage(SYNC_MODIFY_MESSAGES.UMD_DIR_FOUND, { path: umdDir })
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
      formatMessage(SYNC_MODIFY_MESSAGES.UMD_FILES_FOUND, {
        count: allUmdFiles.length
      })
    )
    allUmdFiles.forEach((file) =>
      logToChat(
        formatMessage(SYNC_MODIFY_MESSAGES.UMD_FILE_ITEM, { fileName: file })
      )
    )

    // 3. 检查 scripts/postinstall.js 文件
    const postinstallPath = path.join(modulePath, 'scripts', 'postinstall.js')

    if (!fs.existsSync(postinstallPath)) {
      logToChat(`未找到 postinstall.js 文件: ${postinstallPath}，跳过 UMD 同步`)
      return 0
    }

    // 4. 读取 postinstall.js 文件内容
    const postinstallContent = fs.readFileSync(postinstallPath, 'utf8')

    if (!postinstallContent || postinstallContent.trim().length === 0) {
      logToChat('postinstall.js 文件为空，跳过 UMD 同步')
      return 0
    }

    // 5. 确定目标路径（优先匹配 public/umd/render）
    let targetSubPath = 'public/umd'
    if (postinstallContent.includes('public/umd/render')) {
      targetSubPath = 'public/umd/render'
      logToChat('检测到 public/umd/render 关键字，将拷贝到该路径')
    } else if (postinstallContent.includes('public/umd')) {
      targetSubPath = 'public/umd'
      logToChat('检测到 public/umd 关键字，将拷贝到该路径')
    } else {
      logToChat(
        'postinstall.js 中未找到 public/umd/render 或 public/umd 关键字，跳过 UMD 同步'
      )
      return 0
    }

    // 6. 遍历每个项目路径，拷贝 UMD 文件
    for (const projectPath of projectPaths) {
      try {
        const targetDir = path.join(projectPath, targetSubPath)

        logToChat(
          formatMessage('准备拷贝 UMD 文件到: {path}', { path: targetDir })
        )

        // 确保目标目录存在
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true })
          logToChat(`创建目标目录: ${targetDir}`)
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
              formatMessage(SYNC_MODIFY_MESSAGES.UMD_FILE_COPY_FAILED, {
                fileName
              }),
              error instanceof Error ? error.message : String(error)
            )
          }
        }

        if (filescopied > 0) {
          logToChat(
            formatMessage(SYNC_MODIFY_MESSAGES.UMD_DIR_COPIED, {
              destPath: targetDir,
              count: filescopied
            })
          )
          copiedDirCount++
        }
      } catch (error) {
        logToChat(
          formatMessage('拷贝 UMD 文件到项目失败: {path}', {
            path: projectPath
          }),
          error instanceof Error ? error.message : String(error)
        )
      }
    }
  } catch (error) {
    logToChat(
      SYNC_MODIFY_MESSAGES.UMD_FILE_COPY_FAILED,
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

    // 3. 获取需要同步的模块列表（从缓存中获取）
    const buildedModules = cachedSingleBuildModules

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
    let totalUmdCopied = 0

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

      // 5. 同步 UMD 文件到项目中的匹配位置
      logToChat(SYNC_MODIFY_MESSAGES.UMD_SYNC_START)

      // 过滤掉包含 app.html 和 preview.html 的项目
      const filteredProjectPaths = projectPaths.filter((projectPath) => {
        const shouldSkip = shouldSkipUmdSync(projectPath)
        if (shouldSkip) {
          logToChat(
            formatMessage(SYNC_MODIFY_MESSAGES.UMD_SKIP_PROJECT_WITH_HTML, {
              path: projectPath
            })
          )
        }
        return !shouldSkip
      })

      if (filteredProjectPaths.length > 0) {
        logToChat(
          formatMessage(SYNC_MODIFY_MESSAGES.UMD_FILTERED_PROJECTS, {
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
          formatMessage(SYNC_MODIFY_MESSAGES.UMD_SYNC_SUMMARY, {
            count: umdCopiedCount
          })
        )
        totalUmdCopied += umdCopiedCount
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
    if (totalUmdCopied > 0) {
      logToChat(
        formatMessage(SYNC_MODIFY_MESSAGES.UMD_SYNC_SUMMARY, {
          count: totalUmdCopied
        })
      )
    }

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
 * 构建单个指定模块
 * @returns 是否成功
 */
function buildSingleModule(): boolean {
  try {
    // 获取所有缓存的模块信息
    const allModules = Object.values(singleModulesInfosDetail).flat()

    if (allModules.length === 0) {
      logToChat('⚠️ 没有需要编译的模块')
      return false
    }

    logToChat(`\n🔨 开始编译 ${allModules.length} 个模块...\n`)

    let successCount = 0
    let failCount = 0

    // 清空缓存的构建模块列表
    cachedSingleBuildModules = []

    for (const module of allModules) {
      logToChat(`[1/${allModules.length}] 编译模块: ${module.moduleName}`)
      logToChat(`   路径: ${module.modulePath}`)

      try {
        // 检查是否存在 package.json 和 build 脚本
        const packageJsonPath = path.join(
          module.modulePath,
          FILE_NAMES.PACKAGE_JSON
        )

        if (!fs.existsSync(packageJsonPath)) {
          logToChat(`   ⚠️ 未找到 package.json，跳过编译`)
          continue
        }

        const content = fs.readFileSync(packageJsonPath, ENCODINGS.UTF8)
        const pkg = JSON.parse(content)

        if (!pkg.scripts || !pkg.scripts.build) {
          logToChat(`   ⚠️ 未找到 scripts.build 配置，跳过编译`)
          continue
        }

        // 执行 pnpm run build 命令
        logToChat(`   🔨 执行编译命令: pnpm run build`)

        const startTime = Date.now()

        execSync('pnpm run build', {
          cwd: module.modulePath,
          stdio: 'inherit', // 将编译输出直接显示在控制台
          encoding: 'utf8',
          timeout: 600000 // 10分钟超时
        })

        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        logToChat(`   ✅ 编译成功 (耗时: ${duration}s)\n`)
        successCount++

        // 添加到缓存的构建模块列表
        cachedSingleBuildModules.push({
          moduleName: module.moduleName,
          modulePath: module.modulePath,
          reason: 'changed'
        })
      } catch (error) {
        logToChat(
          `   ❌ 编译失败:`,
          error instanceof Error ? error.message : String(error)
        )
        logToChat('\n')
        failCount++
      }
    }

    logToChat(`\n📊 编译统计:`)
    logToChat(`   ✅ 成功: ${successCount}`)
    logToChat(`   ❌ 失败: ${failCount}`)
    logToChat(`   📦 总计: ${allModules.length}\n`)

    // 根据编译结果返回状态
    if (failCount > 0) {
      logToChat(`❌ 编译完成，但有 ${failCount} 个模块编译失败`)
      return false
    }

    logToChat('🎉 所有模块编译完成！\n')
    return true
  } catch (error) {
    logToChat(
      '❌ 编译模块时出错:',
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
    logToChat('🔄 开始同步指定模块的修改代码...\n')

    // 1. 从用户输入中提取模块名
    const moduleName = extractModuleName(userInput)

    if (!moduleName) {
      logToChat('❌ 无法从用户输入中提取模块名')
      logToChat(`   用户输入: ${userInput}`)
      logToChat(
        '   提示: 请确保输入包含模块名，例如 "同步@ida/ui模块下修改内容"'
      )
      return false
    }

    logToChat(`✅ 提取到模块名: ${moduleName}\n`)

    // 2. 在配置中查找模块
    const moduleInfo = findModuleInConfiguration(moduleName)

    if (!moduleInfo) {
      logToChat(`❌ 在配置中未找到模块: ${moduleName}`)
      return false
    }

    logToChat('')

    // 3. 将模块信息缓存到全局变量
    cacheModuleInfo(moduleInfo)
    logToChat('')

    // 4. 执行模块编译
    const buildResult = buildSingleModule()

    if (!buildResult) {
      logToChat('❌ 同步指定模块失败：构建过程出现错误')
      return false
    }

    // 5. 同步编译后的文件
    const syncResult = syncCompiledFiles()

    if (!syncResult) {
      logToChat('❌ 同步指定模块失败：文件同步出现错误')
      return false
    }

    logToChat('✅ 同步指定模块成功')
    return true
  } catch (error) {
    logToChat(
      '❌ 同步指定模块执行异常:',
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
