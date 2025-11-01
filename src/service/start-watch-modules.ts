import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { FSWatcher } from 'chokidar'
import { configuration } from '../domain/get-configuration'
import { startWatchingModules } from '../domain/start-watch'

/**
 * 注册启动模块监控工具
 */
export function registerStartWatchModules(
  server: McpServer,
  watchers: Map<string, FSWatcher>
): void {
  server.registerTool(
    'start-watch-modules',
    {
      title: 'start-watch-modules',
      description: '遍历配置的模块路径并启动文件变化监控',
      inputSchema: {}
    },
    async () => {
      try {
        const results = startWatchingModules(watchers)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: '模块监控启动完成',
                  totalPaths: configuration.modulePaths.length,
                  activeWatchers: watchers.size,
                  results: results
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
