import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { FSWatcher } from 'chokidar'
import { stopWatchingModules } from '../domain/stop-watch.ts'

/**
 * 注册停止模块监控工具
 */
export function registerStopWatchModules(
  server: McpServer,
  watchers: Map<string, FSWatcher>
): void {
  server.registerTool(
    'stop-watch-modules',
    {
      title: 'stop-watch-modules',
      description: '停止所有正在运行的模块监控',
      inputSchema: {}
    },
    async () => {
      try {
        const stoppedPaths = await stopWatchingModules(watchers)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: '所有模块监控已停止',
                  stoppedCount: stoppedPaths.length,
                  stoppedPaths: stoppedPaths
                },
                null,
                2
              )
            }
          ]
        }
      } catch (e) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`
            }
          ],
          isError: true
        }
      }
    }
  )
}
