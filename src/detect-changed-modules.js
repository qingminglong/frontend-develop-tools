#!/usr/bin/env node

/**
 * Git变更模块检测脚本
 * 分析git变更文件，识别受影响的workspace模块
 */

const { execSync } = require('child_process')
const path = require('path')
const yaml = require('js-yaml')
const fs = require('fs')
const glob = require('glob')

// 读取pnpm-workspace.yaml配置
function readWorkspaceConfig() {
  const workspaceFile = path.join(__dirname, '../pnpm-workspace.yaml')
  const content = fs.readFileSync(workspaceFile, 'utf8')
  return yaml.load(content)
}

// 解析workspace patterns
function getWorkspacePackages(patterns) {
  const rootDir = path.join(__dirname, '..')
  const packages = []

  patterns.forEach(pattern => {
    if (pattern.startsWith('!')) return

    const matches = glob.sync(pattern, {
      cwd: rootDir,
      absolute: false
    })

    matches.forEach(match => {
      const packagePath = path.join(rootDir, match)
      const srcPath = path.join(packagePath, 'src')

      if (fs.existsSync(srcPath)) {
        packages.push({
          name: match,
          path: packagePath,
          srcPath: srcPath
        })
      }
    })
  })

  return packages
}

// 获取git变更文件
function getChangedFiles(compareRef = 'HEAD') {
  try {
    // 获取未暂存的变更
    const unstagedFiles = execSync('git diff --name-only', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)

    // 获取已暂存的变更
    const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)

    // 获取未跟踪的文件
    const untrackedFiles = execSync('git ls-files --others --exclude-standard', {
      encoding: 'utf8'
    })
      .split('\n')
      .filter(Boolean)

    return {
      unstaged: unstagedFiles,
      staged: stagedFiles,
      untracked: untrackedFiles,
      all: [...new Set([...unstagedFiles, ...stagedFiles, ...untrackedFiles])]
    }
  } catch (error) {
    console.error('获取git变更文件失败:', error.message)
    return { unstaged: [], staged: [], untracked: [], all: [] }
  }
}

// 分析受影响的模块
function analyzeChangedModules(changedFiles, packages) {
  const rootDir = path.join(__dirname, '..')
  const moduleChanges = new Map()

  changedFiles.forEach(file => {
    const absolutePath = path.join(rootDir, file)

    // 检查文件是否在某个模块的src目录下
    const matchedPackage = packages.find(pkg => {
      const relPath = path.relative(pkg.srcPath, absolutePath)
      return !relPath.startsWith('..') && !path.isAbsolute(relPath)
    })

    if (matchedPackage) {
      if (!moduleChanges.has(matchedPackage.name)) {
        moduleChanges.set(matchedPackage.name, {
          module: matchedPackage.name,
          files: []
        })
      }

      const fileRelativeToSrc = path.relative(matchedPackage.srcPath, absolutePath)
      moduleChanges.get(matchedPackage.name).files.push(fileRelativeToSrc)
    }
  })

  return Array.from(moduleChanges.values())
}

// 格式化输出
function formatOutput(changes, fileStats) {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║           📊 pnpm Workspace 模块变更分析报告                  ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝\n')

  // 统计信息
  console.log('📈 变更统计:')
  console.log(`   - 未暂存变更: ${fileStats.unstaged.length} 个文件`)
  console.log(`   - 已暂存变更: ${fileStats.staged.length} 个文件`)
  console.log(`   - 未跟踪文件: ${fileStats.untracked.length} 个文件`)
  console.log(`   - 受影响模块: ${changes.length} 个\n`)

  if (changes.length === 0) {
    console.log('✅ 没有模块的 src 目录发生变更\n')
    return
  }

  // 详细变更信息
  console.log('📦 受影响的模块详情:\n')
  console.log('━'.repeat(80))

  changes.forEach((change, index) => {
    console.log(`\n${index + 1}. 模块: \x1b[1m\x1b[35m${change.module}\x1b[0m`)
    console.log(`   变更文件数: ${change.files.length}`)
    console.log('   变更文件:')

    change.files.forEach(file => {
      const ext = path.extname(file)
      const icon =
        {
          '.ts': '📘',
          '.tsx': '📘',
          '.vue': '💚',
          '.js': '📙',
          '.jsx': '📙',
          '.json': '📋',
          '.css': '🎨',
          '.less': '🎨',
          '.scss': '🎨'
        }[ext] || '📄'

      console.log(`      ${icon} ${file}`)
    })
  })

  console.log('\n' + '━'.repeat(80) + '\n')
}

// 主函数
function main() {
  const config = readWorkspaceConfig()
  const packages = getWorkspacePackages(config.packages)
  const fileStats = getChangedFiles()
  const changes = analyzeChangedModules(fileStats.all, packages)

  formatOutput(changes, fileStats)

  // 如果需要在CI/CD中使用，可以返回退出码
  if (process.argv.includes('--ci')) {
    process.exit(changes.length > 0 ? 0 : 1)
  }
}

// 运行
main()



