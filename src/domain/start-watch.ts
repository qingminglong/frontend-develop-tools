import { watchModulesWithPath } from './watch-modules'
import { configuration } from './get-configuration'
import type { FSWatcher } from 'chokidar'
import { ERROR_MESSAGES, WATCHER_STATUS } from '../consts/index'

/**
 * 启动模块监控
 * @param watchers 监控器存储Map
 * @returns 启动结果数组
 */
export function startWatchingModules(
  watchers: Map<string, FSWatcher>
): Array<{ path: string; status: string; error?: string }> {
  if (configuration.modulePaths.length === 0) {
    throw new Error(ERROR_MESSAGES.NO_MODULE_PATHS)
  }

  const results: Array<{ path: string; status: string; error?: string }> = []

  // 遍历所有模块路径并启动监控
  for (const modulePath of configuration.modulePaths) {
    try {
      // 如果已经在监控，跳过
      if (watchers.has(modulePath)) {
        results.push({
          path: modulePath,
          status: WATCHER_STATUS.ALREADY_WATCHING
        })
        continue
      }

      // 启动监控
      const watcher = watchModulesWithPath(modulePath)
      watchers.set(modulePath, watcher)

      results.push({
        path: modulePath,
        status: WATCHER_STATUS.STARTED
      })
    } catch (error) {
      results.push({
        path: modulePath,
        status: WATCHER_STATUS.FAILED,
        error:
          error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR
      })
    }
  }

  return results
}
