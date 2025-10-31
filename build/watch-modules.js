#!/usr/bin/env node
import chokidar from 'chokidar';
import path from 'path';
import yaml from 'js-yaml';
import fs from 'fs';
import { glob } from 'glob';
import { debounce } from 'es-toolkit';
import { detectAndCacheChangedModules } from './detect-changed-modules.js';
import { getAllBuildedModules } from './build-modules.js';
import { FILE_NAMES, ENCODINGS, PACKAGE_FIELDS, FILE_EVENTS, EVENT_NAMES, SPECIAL_CHARS, ANSI_COLORS, CHOKIDAR_CONFIG, DATE_FORMAT_OPTIONS, LOCALES, LOG_MESSAGES, ERROR_MESSAGES } from './consts/index.js';
// 创建防抖版本的 getAllBuildedModules 函数，间隔 1 秒
const debouncedGetAllBuildedModules = debounce(() => {
    getAllBuildedModules();
}, 2000);
/**
 * 读取pnpm-workspace.yaml配置
 * @param {string} modulePath - 项目根目录路径
 */
function readWorkspaceConfig(modulePath) {
    const workspaceFile = path.join(modulePath, FILE_NAMES.WORKSPACE_CONFIG);
    const content = fs.readFileSync(workspaceFile, ENCODINGS.UTF8);
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
        if (pattern.startsWith(SPECIAL_CHARS.EXCLAMATION)) {
            return;
        }
        // 解析glob pattern
        const matches = glob.globSync(pattern, {
            cwd: rootDir,
            absolute: false
        });
        matches.forEach((match) => {
            const packagePath = path.join(rootDir, match);
            const srcPath = path.join(packagePath, FILE_NAMES.SRC_DIR);
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
    const timestamp = new Date().toLocaleString(LOCALES.ZH_CN, DATE_FORMAT_OPTIONS);
    const eventMap = {
        [FILE_EVENTS.ADD]: EVENT_NAMES.ADD,
        [FILE_EVENTS.CHANGE]: EVENT_NAMES.CHANGE,
        [FILE_EVENTS.UNLINK]: EVENT_NAMES.UNLINK
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
    const eventColor = {
        [EVENT_NAMES.ADD]: ANSI_COLORS.GREEN,
        [EVENT_NAMES.CHANGE]: ANSI_COLORS.YELLOW,
        [EVENT_NAMES.UNLINK]: ANSI_COLORS.RED
    };
    const eventColorValue = eventColor[info.event] || ANSI_COLORS.CYAN;
    console.error(`${ANSI_COLORS.DIM}[${info.timestamp}]${ANSI_COLORS.RESET} ` +
        `${eventColorValue}${info.event}${ANSI_COLORS.RESET} ` +
        `${ANSI_COLORS.BRIGHT}${ANSI_COLORS.MAGENTA}${info.module}${ANSI_COLORS.RESET} ` +
        `${ANSI_COLORS.CYAN}${info.file}${ANSI_COLORS.RESET}`);
}
/**
 * 监控指定路径的模块变化
 * @param {string} modulePath - 项目根目录路径
 * @returns {FSWatcher} 返回监控器实例，用于后续停止监控
 */
export function watchModulesWithPath(modulePath) {
    // 使用 console.error 输出到 stderr，避免干扰 MCP 的 stdout 通信
    console.error(LOG_MESSAGES.MONITORING_PROJECT.replace('{path}', modulePath));
    // 验证路径
    if (!fs.existsSync(modulePath)) {
        throw new Error(`${ERROR_MESSAGES.PATH_NOT_EXISTS}: ${modulePath}`);
    }
    const workspaceFile = path.join(modulePath, FILE_NAMES.WORKSPACE_CONFIG);
    if (!fs.existsSync(workspaceFile)) {
        throw new Error(`${ERROR_MESSAGES.WORKSPACE_FILE_NOT_FOUND}: ${workspaceFile}`);
    }
    // 读取workspace配置
    const config = readWorkspaceConfig(modulePath);
    const packages = getWorkspacePackages(config[PACKAGE_FIELDS.PACKAGES], modulePath);
    if (packages.length === 0) {
        console.error(LOG_MESSAGES.NO_SRC_MODULES);
        console.error(LOG_MESSAGES.CHECK_CONFIG);
    }
    console.error(LOG_MESSAGES.MODULES_FOUND.replace('{count}', String(packages.length)));
    packages.forEach((pkg) => {
        console.error(`   - ${pkg.name}`);
    });
    console.error(LOG_MESSAGES.START_WATCHING);
    console.error('━'.repeat(80));
    console.error('');
    // 创建监控器
    const watchPaths = packages.map((pkg) => pkg.srcPath);
    const watcher = chokidar.watch(watchPaths, {
        ignored: CHOKIDAR_CONFIG.IGNORED_PATTERNS,
        persistent: true,
        ignoreInitial: true, // 忽略初始扫描
        awaitWriteFinish: {
            stabilityThreshold: CHOKIDAR_CONFIG.STABILITY_THRESHOLD,
            pollInterval: CHOKIDAR_CONFIG.POLL_INTERVAL
        }
    });
    // 监听变化事件
    watcher
        .on(FILE_EVENTS.ADD, (filePath) => {
        const info = formatChangeInfo(FILE_EVENTS.ADD, filePath, packages, modulePath);
        logChange(info);
        // 调用公用函数检测并缓存变更的模块
        detectAndCacheChangedModules(modulePath);
        // 使用防抖版本，避免频繁调用
        debouncedGetAllBuildedModules();
    })
        .on(FILE_EVENTS.CHANGE, (filePath) => {
        const info = formatChangeInfo(FILE_EVENTS.CHANGE, filePath, packages, modulePath);
        logChange(info);
        // 调用公用函数检测并缓存变更的模块
        detectAndCacheChangedModules(modulePath);
        // 使用防抖版本，避免频繁调用
        debouncedGetAllBuildedModules();
    })
        .on(FILE_EVENTS.UNLINK, (filePath) => {
        const info = formatChangeInfo(FILE_EVENTS.UNLINK, filePath, packages, modulePath);
        logChange(info);
        // 调用公用函数检测并缓存变更的模块
        detectAndCacheChangedModules(modulePath);
        // 使用防抖版本，避免频繁调用
        debouncedGetAllBuildedModules();
    })
        .on('error', (error) => {
        console.error(LOG_MESSAGES.WATCH_ERROR.replace('{error}', String(error)));
    });
    return watcher;
}
