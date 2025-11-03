import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { FSWatcher } from 'chokidar'
import { configuration } from '../domain/get-configuration.ts'
import { ERROR_MESSAGES } from '../consts/index.ts'

/**
 * 注册获取监控状态工具
 */
export function registerGetWatchStatus(
  server: McpServer,
  watchers: Map<string, FSWatcher>
): void {
  server.registerTool(
    'get-watch-status',
    {
      title: 'get-watch-status',
      description: '获取当前模块监控的状态信息',
      inputSchema: {}
    },
    async () => {
      try {
        const watchingPaths = Array.from(watchers.keys())
        const notWatchingPaths = configuration.modulePaths.filter(
          (p) => !watchers.has(p)
        )

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalConfiguredPaths: configuration.modulePaths.length,
                  activeWatchers: watchers.size,
                  watchingPaths: watchingPaths,
                  notWatchingPaths: notWatchingPaths
                },
                null,
                2
              )
            }
          ]
        }
      } catch (e) {
        const errorMsg =
          e instanceof Error ? e.message : ERROR_MESSAGES.UNKNOWN_ERROR
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMsg}${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`
            }
          ],
          isError: true
        }
      }
    }
  )
}
