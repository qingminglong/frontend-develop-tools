#!/usr/bin/env node
/**
 * pnpm workspace 模块变化监控脚本
 * 监控所有workspace包的src目录变化，实时输出变化的模块信息
 *
 * 使用方式：
 *   node watch-modules.js [项目路径]
 *   node watch-modules.js /path/to/your/project
 *   node watch-modules.js --help
 */
import chokidar from 'chokidar';
import path from 'path';
import yaml from 'js-yaml';
import fs from 'fs';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { detectAndCacheChangedModules } from './detect-changed-modules.js';
// 获取当前文件的目录路径（ES 模块中的 __dirname 替代）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * 解析命令行参数，获取项目根目录路径
 */
function parseProjectPath() {
    const args = process.argv.slice(2);
    // 显示帮助信息
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
📚 pnpm workspace 模块变化监控工具

使用方式：
  node watch-modules.js [项目路径]

参数说明：
  项目路径        要监控的 pnpm workspace 项目的根目录路径（可选）
                 如果不提供，默认使用脚本所在目录的上级目录

示例：
  node watch-modules.js                          # 监控默认项目
  node watch-modules.js /home/user/my-project    # 监控指定项目
  node watch-modules.js --help                   # 显示帮助信息

选项：
  -h, --help     显示帮助信息
    `);
        process.exit(0);
    }
    // 如果提供了路径参数，使用提供的路径
    if (args.length > 0 && !args[0].startsWith('-')) {
        const providedPath = args[0];
        const absolutePath = path.isAbsolute(providedPath)
            ? providedPath
            : path.resolve(process.cwd(), providedPath);
        return absolutePath;
    }
    // 默认使用脚本所在目录的上级目录
    return path.join(__dirname, '..');
}
/**
 * 验证项目路径是否有效
 */
function validateProjectPath(modulePath) {
    if (!fs.existsSync(modulePath)) {
        console.error(`❌ 错误: 项目路径不存在: ${modulePath}`);
        process.exit(1);
    }
    const workspaceFile = path.join(modulePath, 'pnpm-workspace.yaml');
    if (!fs.existsSync(workspaceFile)) {
        console.error(`❌ 错误: 在项目路径中找不到 pnpm-workspace.yaml 文件`);
        console.error(`   查找路径: ${workspaceFile}`);
        console.error(`   请确保提供的是 pnpm workspace 项目的根目录`);
        process.exit(1);
    }
    return true;
}
/**
 * 读取pnpm-workspace.yaml配置
 * @param {string} modulePath - 项目根目录路径
 */
function readWorkspaceConfig(modulePath) {
    const workspaceFile = path.join(modulePath, 'pnpm-workspace.yaml');
    const content = fs.readFileSync(workspaceFile, 'utf8');
    return yaml.load(content);
}
/**
 * 解析workspace patterns，获取所有包的路径
 * @param {string[]} patterns - workspace patterns
 * @param {string} rootDir - 项目根目录路径
 */
function getWorkspacePackages(patterns, rootDir) {
    const packages = [];
    patterns.forEach((pattern) => {
        // 跳过排除模式
        if (pattern.startsWith('!')) {
            return;
        }
        // 解析glob pattern
        const matches = glob.globSync(pattern, {
            cwd: rootDir,
            absolute: false
        });
        matches.forEach((match) => {
            const packagePath = path.join(rootDir, match);
            const srcPath = path.join(packagePath, 'src');
            // 检查是否存在src目录
            if (fs.existsSync(srcPath)) {
                packages.push({
                    name: match,
                    path: packagePath,
                    srcPath: srcPath
                });
            }
        });
    });
    return packages;
}
/**
 * 格式化输出变化信息
 * @param {string} event - 事件类型
 * @param {string} filePath - 文件路径
 * @param {Array} packages - 包列表
 * @param {string} rootDir - 项目根目录路径
 */
function formatChangeInfo(event, filePath, packages, rootDir) {
    const relativePath = path.relative(rootDir, filePath);
    // 找出是哪个模块
    const matchedPackage = packages.find((pkg) => filePath.startsWith(pkg.srcPath));
    if (!matchedPackage) {
        return null;
    }
    const fileRelativeToSrc = path.relative(matchedPackage.srcPath, filePath);
    const timestamp = new Date().toLocaleString('zh-CN', {
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const eventMap = {
        add: '新增',
        change: '修改',
        unlink: '删除'
    };
    return {
        timestamp,
        event: eventMap[event] || event,
        module: matchedPackage.name,
        file: fileRelativeToSrc,
        fullPath: relativePath
    };
}
// 输出彩色日志（使用 stderr 避免干扰 MCP 通信）
function logChange(info) {
    if (!info)
        return;
    const colors = {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        dim: '\x1b[2m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m'
    };
    const eventColor = {
        新增: colors.green,
        修改: colors.yellow,
        删除: colors.red
    };
    const eventColorValue = eventColor[info.event] || colors.cyan;
    console.error(`${colors.dim}[${info.timestamp}]${colors.reset} ` +
        `${eventColorValue}${info.event}${colors.reset} ` +
        `${colors.bright}${colors.magenta}${info.module}${colors.reset} ` +
        `${colors.cyan}${info.file}${colors.reset}`);
}
/**
 * 监控指定路径的模块变化
 * @param {string} modulePath - 项目根目录路径
 * @returns {FSWatcher} 返回监控器实例，用于后续停止监控
 */
export function watchModulesWithPath(modulePath) {
    // 使用 console.error 输出到 stderr，避免干扰 MCP 的 stdout 通信
    console.error(`📂 监控项目: ${modulePath}\n`);
    // 验证路径
    if (!fs.existsSync(modulePath)) {
        throw new Error(`项目路径不存在: ${modulePath}`);
    }
    const workspaceFile = path.join(modulePath, 'pnpm-workspace.yaml');
    if (!fs.existsSync(workspaceFile)) {
        throw new Error(`在项目路径中找不到 pnpm-workspace.yaml 文件: ${workspaceFile}`);
    }
    // 读取workspace配置
    const config = readWorkspaceConfig(modulePath);
    const packages = getWorkspacePackages(config.packages, modulePath);
    if (packages.length === 0) {
        console.error('⚠️  警告: 没有找到包含 src 目录的模块');
        console.error('   请检查 pnpm-workspace.yaml 配置和包目录结构');
    }
    console.error(`📦 找到 ${packages.length} 个包含 src 目录的模块:\n`);
    packages.forEach((pkg) => {
        console.error(`   - ${pkg.name}`);
    });
    console.error('\n👀 开始监控文件变化...\n');
    console.error('━'.repeat(80));
    console.error('');
    // 创建监控器
    const watchPaths = packages.map((pkg) => pkg.srcPath);
    const watcher = chokidar.watch(watchPaths, {
        ignored: [
            /(^|[\/\\])\../, // 忽略隐藏文件
            '**/node_modules/**', // 忽略node_modules
            '**/dist/**', // 忽略构建产物
            '**/*.map' // 忽略source map
        ],
        persistent: true,
        ignoreInitial: true, // 忽略初始扫描
        awaitWriteFinish: {
            stabilityThreshold: 100, // 文件稳定100ms后才触发
            pollInterval: 50
        }
    });
    // 监听变化事件
    watcher
        .on('add', (filePath) => {
        const info = formatChangeInfo('add', filePath, packages, modulePath);
        logChange(info);
        // 调用公用函数检测并缓存变更的模块
        detectAndCacheChangedModules(modulePath);
    })
        .on('change', (filePath) => {
        const info = formatChangeInfo('change', filePath, packages, modulePath);
        logChange(info);
        // 调用公用函数检测并缓存变更的模块
        detectAndCacheChangedModules(modulePath);
    })
        .on('unlink', (filePath) => {
        const info = formatChangeInfo('unlink', filePath, packages, modulePath);
        logChange(info);
        // 调用公用函数检测并缓存变更的模块
        detectAndCacheChangedModules(modulePath);
    })
        .on('error', (error) => {
        console.error(`❌ 监控错误: ${error}`);
    });
    return watcher;
}
/**
 * 主函数（命令行模式）
 */
export default function watchModules() {
    console.error('🚀 正在启动 pnpm workspace 模块变化监控...\n');
    // 解析并验证项目路径
    const modulePath = parseProjectPath();
    validateProjectPath(modulePath);
    // 调用路径版本的函数
    const watcher = watchModulesWithPath(modulePath);
    // 优雅退出
    process.on('SIGINT', () => {
        console.error('\n\n👋 停止监控...');
        watcher.close();
        process.exit(0);
    });
}
