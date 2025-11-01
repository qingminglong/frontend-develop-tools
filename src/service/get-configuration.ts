import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { configuration } from '../domain/get-configuration'

/**
 * 注册获取配置信息工具
 */
export function registerGetConfiguration(server: McpServer): void {
  server.registerTool(
    'get-configuration',
    {
      title: 'get-configuration',
      description: '获取模块路径和项目路径的配置信息',
      inputSchema: {}
    },
    async () => {
      try {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(configuration, null, 2)
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
