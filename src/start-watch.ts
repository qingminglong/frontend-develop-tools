import { watchModulesWithPath } from './watch-modules.js'
import { configuration } from './get-configuration.js'
import type { FSWatcher } from 'chokidar'

/**
 * 启动模块监控
 * @param watchers 监控器存储Map
 * @returns 启动结果数组
 */
export function startWatchingModules(
  watchers: Map<string, FSWatcher>
): Array<{ path: string; status: string; error?: string }> {
  if (configuration.modulePaths.length === 0) {
    throw new Error('没有配置需要监控的模块路径')
  }

  const results: Array<{ path: string; status: string; error?: string }> = []

  // 遍历所有模块路径并启动监控
  for (const modulePath of configuration.modulePaths) {
    try {
      // 如果已经在监控，跳过
      if (watchers.has(modulePath)) {
        results.push({
          path: modulePath,
          status: 'already_watching'
        })
        continue
      }

      // 启动监控
      const watcher = watchModulesWithPath(modulePath)
      watchers.set(modulePath, watcher)

      results.push({
        path: modulePath,
        status: 'started'
      })
    } catch (error) {
      results.push({
        path: modulePath,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return results
}
