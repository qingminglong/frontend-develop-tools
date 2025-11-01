import type { FSWatcher } from 'chokidar'

/**
 * 停止所有模块监控
 * @param watchers 监控器存储Map
 * @returns 已停止的模块路径列表
 */
export async function stopWatchingModules(
  watchers: Map<string, FSWatcher>
): Promise<string[]> {
  const stoppedPaths: string[] = []

  // 停止所有监控器
  for (const [modulePath, watcher] of watchers.entries()) {
    await watcher.close()
    stoppedPaths.push(modulePath)
  }

  // 清空监控器映射
  watchers.clear()

  return stoppedPaths
}
