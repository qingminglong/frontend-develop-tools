#!/usr/bin/env node
import chokidar, { type FSWatcher } from 'chokidar'
import path from 'path'
import yaml from 'js-yaml'
import fs from 'fs'
import { glob } from 'glob'
import { detectAndCacheChangedModules } from './detect-changed-modules.ts'
import { getAllBuildedModules } from './build-modules.ts'
import type {
  WorkspacePackage,
  WorkspaceConfig,
  ChangeInfo,
  EventType,
  EventNameType
} from '../types/watch-modules.ts'
import {
  FILE_NAMES,
  ENCODINGS,
  PACKAGE_FIELDS,
  FILE_EVENTS,
  EVENT_NAMES,
  SPECIAL_CHARS,
  ANSI_COLORS,
  CHOKIDAR_CONFIG,
  DATE_FORMAT_OPTIONS,
  LOCALES,
  LOG_MESSAGES,
  ERROR_MESSAGES
} from '../consts/index.ts'

/**
 * 任务管理器类
 * 用于管理模块检测和构建任务，确保新任务触发时取消之前未完成的任务
 */
class TaskManager {
  private abortController: AbortController | null = null
  private isRunning = false

  /**
   * 执行任务，如果有正在运行的任务则先取消
   * @param modulePath - 项目根目录路径
   */
  async executeTask(modulePath: string): Promise<void> {
    // 如果有正在执行的任务，先取消它
    if (this.isRunning && this.abortController) {
      console.error('⚠️  检测到新的文件变更，取消之前的任务...')
      this.abortController.abort()
    }

    // 创建新的 AbortController
    this.abortController = new AbortController()
    const signal = this.abortController.signal
    this.isRunning = true

    try {
      // 检查是否已被取消
      if (signal.aborted) {
        console.error('❌ 任务已被取消')
        return
      }

      // 执行检测变更模块的任务
      await this.runWithAbort(
        () => detectAndCacheChangedModules(modulePath),
        signal
      )

      // 再次检查是否已被取消
      if (signal.aborted) {
        console.error('❌ 任务已被取消')
        return
      }

      // 执行获取构建模块列表的任务
      await this.runWithAbort(() => getAllBuildedModules(), signal)

      console.error('✅ 任务执行完成')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('❌ 任务被中断')
      } else {
        console.error('❌ 任务执行出错:', error)
      }
    } finally {
      this.isRunning = false
      this.abortController = null
    }
  }

  /**
   * 在支持中断的环境中运行函数
   * @param fn - 要执行的函数
   * @param signal - 中断信号
   */
  private async runWithAbort<T>(fn: () => T, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      // 如果已经被取消，立即拒绝
      if (signal.aborted) {
        const error = new Error('Task was aborted')
        error.name = 'AbortError'
        reject(error)
        return
      }

      // 监听中断信号
      const abortHandler = () => {
        const error = new Error('Task was aborted')
        error.name = 'AbortError'
        reject(error)
      }

      signal.addEventListener('abort', abortHandler)

      // 使用 setTimeout 让出执行权，使任务可以被中断
      setTimeout(() => {
        try {
          if (signal.aborted) {
            const error = new Error('Task was aborted')
            error.name = 'AbortError'
            reject(error)
            return
          }

          const result = fn()
          signal.removeEventListener('abort', abortHandler)
          resolve(result)
        } catch (error) {
          signal.removeEventListener('abort', abortHandler)
          reject(error)
        }
      }, 0)
    })
  }

  /**
   * 取消当前正在执行的任务
   */
  cancelCurrentTask(): void {
    if (this.isRunning && this.abortController) {
      this.abortController.abort()
    }
  }
}

// 创建全局任务管理器实例
const taskManager = new TaskManager()

/**
 * 读取pnpm-workspace.yaml配置
 * @param {string} modulePath - 项目根目录路径
 */
function readWorkspaceConfig(modulePath: string): WorkspaceConfig {
  const workspaceFile = path.join(modulePath, FILE_NAMES.WORKSPACE_CONFIG)
  const content = fs.readFileSync(workspaceFile, ENCODINGS.UTF8)
  return yaml.load(content) as WorkspaceConfig
}

/**
 * 解析workspace patterns，获取所有包的路径
 * @param {string[]} patterns - workspace patterns
 * @param {string} rootDir - 项目根目录路径
 */
function getWorkspacePackages(
  patterns: string[],
  rootDir: string
): WorkspacePackage[] {
  const packages: WorkspacePackage[] = []

  patterns.forEach((pattern: string) => {
    // 跳过排除模式
    if (pattern.startsWith(SPECIAL_CHARS.EXCLAMATION)) {
      return
    }

    // 解析glob pattern
    const matches = glob.globSync(pattern, {
      cwd: rootDir,
      absolute: false
    })

    matches.forEach((match) => {
      const packagePath = path.join(rootDir, match)
      const srcPath = path.join(packagePath, FILE_NAMES.SRC_DIR)

      // 检查是否存在src目录
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

/**
 * 格式化输出变化信息
 * @param {string} event - 事件类型
 * @param {string} filePath - 文件路径
 * @param {Array} packages - 包列表
 * @param {string} rootDir - 项目根目录路径
 */
function formatChangeInfo(
  event: EventType,
  filePath: string,
  packages: WorkspacePackage[],
  rootDir: string
): ChangeInfo | null {
  const relativePath = path.relative(rootDir, filePath)

  // 找出是哪个模块
  const matchedPackage = packages.find((pkg: WorkspacePackage) =>
    filePath.startsWith(pkg.srcPath)
  )

  if (!matchedPackage) {
    return null
  }

  const fileRelativeToSrc = path.relative(matchedPackage.srcPath, filePath)
  const timestamp = new Date().toLocaleString(
    LOCALES.ZH_CN,
    DATE_FORMAT_OPTIONS
  )

  const eventMap: Record<EventType, EventNameType> = {
    [FILE_EVENTS.ADD]: EVENT_NAMES.ADD,
    [FILE_EVENTS.CHANGE]: EVENT_NAMES.CHANGE,
    [FILE_EVENTS.UNLINK]: EVENT_NAMES.UNLINK
  }

  return {
    timestamp,
    event: eventMap[event] || event,
    module: matchedPackage.name,
    file: fileRelativeToSrc,
    fullPath: relativePath
  }
}

// 输出彩色日志（使用 stderr 避免干扰 MCP 通信）
function logChange(info: ChangeInfo | null): void {
  if (!info) return

  const eventColor: Record<EventNameType, string> = {
    [EVENT_NAMES.ADD]: ANSI_COLORS.GREEN,
    [EVENT_NAMES.CHANGE]: ANSI_COLORS.YELLOW,
    [EVENT_NAMES.UNLINK]: ANSI_COLORS.RED
  }

  const eventColorValue =
    eventColor[info.event as EventNameType] || ANSI_COLORS.CYAN

  console.error(
    `${ANSI_COLORS.DIM}[${info.timestamp}]${ANSI_COLORS.RESET} ` +
      `${eventColorValue}${info.event}${ANSI_COLORS.RESET} ` +
      `${ANSI_COLORS.BRIGHT}${ANSI_COLORS.MAGENTA}${info.module}${ANSI_COLORS.RESET} ` +
      `${ANSI_COLORS.CYAN}${info.file}${ANSI_COLORS.RESET}`
  )
}

/**
 * 监控指定路径的模块变化
 * @param {string} modulePath - 项目根目录路径
 * @returns {FSWatcher} 返回监控器实例，用于后续停止监控
 */
export function watchModulesWithPath(modulePath: string): FSWatcher {
  // 使用 console.error 输出到 stderr，避免干扰 MCP 的 stdout 通信
  console.error(LOG_MESSAGES.MONITORING_PROJECT.replace('{path}', modulePath))

  // 验证路径
  if (!fs.existsSync(modulePath)) {
    throw new Error(`${ERROR_MESSAGES.PATH_NOT_EXISTS}: ${modulePath}`)
  }

  const workspaceFile = path.join(modulePath, FILE_NAMES.WORKSPACE_CONFIG)
  if (!fs.existsSync(workspaceFile)) {
    throw new Error(
      `${ERROR_MESSAGES.WORKSPACE_FILE_NOT_FOUND}: ${workspaceFile}`
    )
  }

  // 读取workspace配置
  const config = readWorkspaceConfig(modulePath)
  const packages = getWorkspacePackages(
    config[PACKAGE_FIELDS.PACKAGES],
    modulePath
  )

  if (packages.length === 0) {
    console.error(LOG_MESSAGES.NO_SRC_MODULES)
    console.error(LOG_MESSAGES.CHECK_CONFIG)
  }

  console.error(
    LOG_MESSAGES.MODULES_FOUND.replace('{count}', String(packages.length))
  )
  packages.forEach((pkg: WorkspacePackage) => {
    console.error(`   - ${pkg.name}`)
  })
  console.error(LOG_MESSAGES.START_WATCHING)
  console.error('━'.repeat(80))
  console.error('')

  // 创建监控器
  const watchPaths = packages.map((pkg: WorkspacePackage) => pkg.srcPath)

  const watcher = chokidar.watch(watchPaths, {
    ignored: CHOKIDAR_CONFIG.IGNORED_PATTERNS,
    persistent: true,
    ignoreInitial: true, // 忽略初始扫描
    awaitWriteFinish: {
      stabilityThreshold: CHOKIDAR_CONFIG.STABILITY_THRESHOLD,
      pollInterval: CHOKIDAR_CONFIG.POLL_INTERVAL
    }
  })

  // 监听变化事件
  watcher
    .on(FILE_EVENTS.ADD, (filePath: string) => {
      const info = formatChangeInfo(
        FILE_EVENTS.ADD,
        filePath,
        packages,
        modulePath
      )
      logChange(info)
      // 使用任务管理器执行任务，自动取消之前未完成的任务
      taskManager.executeTask(modulePath).catch((error) => {
        if (error?.name !== 'AbortError') {
          console.error('任务执行失败:', error)
        }
      })
    })
    .on(FILE_EVENTS.CHANGE, (filePath: string) => {
      const info = formatChangeInfo(
        FILE_EVENTS.CHANGE,
        filePath,
        packages,
        modulePath
      )
      logChange(info)
      // 使用任务管理器执行任务，自动取消之前未完成的任务
      taskManager.executeTask(modulePath).catch((error) => {
        if (error?.name !== 'AbortError') {
          console.error('任务执行失败:', error)
        }
      })
    })
    .on(FILE_EVENTS.UNLINK, (filePath: string) => {
      const info = formatChangeInfo(
        FILE_EVENTS.UNLINK,
        filePath,
        packages,
        modulePath
      )
      logChange(info)
      // 使用任务管理器执行任务，自动取消之前未完成的任务
      taskManager.executeTask(modulePath).catch((error) => {
        if (error?.name !== 'AbortError') {
          console.error('任务执行失败:', error)
        }
      })
    })
    .on('error', (error: unknown) => {
      console.error(LOG_MESSAGES.WATCH_ERROR.replace('{error}', String(error)))
    })

  return watcher
}
