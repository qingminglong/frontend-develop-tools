import { buildModules, getCachedBuildModules } from './build-modules.ts'
import { configuration } from './get-configuration.ts'
import { logToChat } from '../utils/index.ts'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

/**
 * 检查并安装项目依赖
 * @param projectPath - 项目路径
 * @returns 是否成功
 */
function ensureProjectDependencies(projectPath: string): boolean {
  try {
    const nodeModulesPath = path.join(projectPath, 'node_modules')

    // 检查 node_modules 是否存在且不为空
    if (
      !fs.existsSync(nodeModulesPath) ||
      fs.readdirSync(nodeModulesPath).length === 0
    ) {
      logToChat(`   📦 项目 ${projectPath} 缺少依赖，开始安装...`)
      execSync('pnpm install', {
        cwd: projectPath,
        stdio: 'inherit',
        encoding: 'utf8'
      })
      logToChat(`   ✅ 依赖安装完成`)
      return true
    }

    logToChat(`   ✓ 项目依赖已存在`)
    return true
  } catch (error) {
    logToChat(
      `   ❌ 安装依赖失败:`,
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
    const pnpmPath = path.join(nodeModulesPath, '.pnpm')

    if (!fs.existsSync(pnpmPath)) {
      logToChat(`   ⚠️  未找到 .pnpm 目录: ${pnpmPath}`)
      return null
    }

    // 将 @scope/package-name 拆分并转换为 @scope+package-name
    const moduleNames = moduleName.split('/')
    const projectModulesName = moduleNames.join('+')

    logToChat(`   🔍 查找模块: ${moduleName} (搜索前缀: ${projectModulesName})`)

    // 查找以 projectModulesName 为前缀的目录
    const pnpmDirs = fs.readdirSync(pnpmPath)
    const matchedDir = pnpmDirs.find((dir) =>
      dir.startsWith(projectModulesName)
    )

    if (!matchedDir) {
      logToChat(`   ⚠️  未找到匹配的 pnpm 目录，前缀: ${projectModulesName}`)
      return null
    }

    logToChat(`   ✓ 找到 pnpm 目录: ${matchedDir}: ${projectModulesName}`)

    // 构建目标路径: .pnpm/{matched}/node_modules/@scope/package-name
    let targetPath = path.join(pnpmPath, matchedDir, 'node_modules')

    // 逐级查找目录
    for (const namePart of moduleNames) {
      targetPath = path.join(targetPath, namePart)
      if (!fs.existsSync(targetPath)) {
        logToChat(`   ⚠️  目录不存在: ${targetPath}`)
        return null
      }
    }

    logToChat(`   ✓ 目标路径: ${targetPath}`)
    return targetPath
  } catch (error) {
    logToChat(
      `   ❌ 查找模块路径失败:`,
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
    logToChat(`     ⚠️  源目录不存在: ${srcDir}`)
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
    logToChat('\n📦 开始同步编译后的文件...')

    // 1. 获取项目路径列表
    const { projectPaths } = configuration

    if (!projectPaths || projectPaths.length === 0) {
      logToChat('⚠️  未配置项目路径')
      return true
    }

    logToChat(`📂 项目列表 (${projectPaths.length}):`)
    projectPaths.forEach((p) => logToChat(`   - ${p}`))

    // 2. 遍历项目路径，确保依赖已安装
    logToChat('\n🔍 检查项目依赖...')
    for (const projectPath of projectPaths) {
      if (!ensureProjectDependencies(projectPath)) {
        logToChat(`❌ 项目 ${projectPath} 依赖检查失败，跳过`)
        continue
      }
    }

    // 3. 获取需要同步的模块列表
    const buildedModules = getCachedBuildModules()

    if (buildedModules.length === 0) {
      logToChat('\n⚠️  没有需要同步的模块')
      return true
    }

    logToChat(`\n📋 需要同步的模块 (${buildedModules.length}):`)
    buildedModules.forEach((m) => logToChat(`   - ${m.moduleName}`))

    // 4. 对每个模块和每个项目进行同步
    logToChat('\n🔄 开始同步文件...\n')

    let syncCount = 0
    let skipCount = 0

    for (const module of buildedModules) {
      logToChat(`\n处理模块: ${module.moduleName}`)

      for (const projectPath of projectPaths) {
        const nodeModulesPath = path.join(projectPath, 'node_modules')

        // 查找目标路径
        const targetPath = findPnpmModulePath(
          nodeModulesPath,
          module.moduleName
        )

        if (!targetPath) {
          logToChat(`   ⚠️  跳过项目: ${projectPath}`)
          skipCount++
          continue
        }

        // 拷贝 dist、es、lib 目录
        const dirsToCopy = ['dist', 'es', 'lib']
        let copiedDirs = 0

        for (const dirName of dirsToCopy) {
          const srcDir = path.join(module.modulePath, dirName)
          const destDir = path.join(targetPath, dirName)

          if (fs.existsSync(srcDir)) {
            logToChat(`     📁 拷贝 ${dirName}...`)
            try {
              // 删除旧的目标目录
              if (fs.existsSync(destDir)) {
                fs.rmSync(destDir, { recursive: true, force: true })
              }
              copyDirectory(srcDir, destDir)
              logToChat(`     ✅ ${dirName} 拷贝成功`)
              copiedDirs++
            } catch (error) {
              logToChat(
                `     ❌ ${dirName} 拷贝失败:`,
                error instanceof Error ? error.message : String(error)
              )
            }
          }
        }

        if (copiedDirs > 0) {
          logToChat(`   ✅ 同步到项目: ${projectPath} (${copiedDirs} 个目录)`)
          syncCount++
        } else {
          logToChat(`   ⚠️  没有可拷贝的目录: ${projectPath}`)
          skipCount++
        }
      }
    }

    logToChat(`\n\n📊 同步统计:`)
    logToChat(`   ✅ 成功: ${syncCount}`)
    logToChat(`   ⚠️  跳过: ${skipCount}`)
    logToChat(`   📦 模块: ${buildedModules.length}`)
    logToChat(`   📂 项目: ${projectPaths.length}\n`)

    return true
  } catch (error) {
    logToChat(
      '❌ 同步编译文件失败:',
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
    logToChat('🔄 开始同步修改代码...')

    // 调用 buildModules 执行构建
    const buildResult = buildModules()

    if (!buildResult) {
      logToChat('❌ 同步修改代码失败：构建过程出现错误')
      return false
    }

    // 同步编译后的文件
    const syncResult = syncCompiledFiles()

    if (!syncResult) {
      logToChat('❌ 同步修改代码失败：文件同步出现错误')
      return false
    }

    logToChat('✅ 同步修改代码成功')
    return true
  } catch (error) {
    logToChat(
      '❌ 同步修改代码执行异常:',
      error instanceof Error ? error.message : String(error)
    )
    return false
  }
}
