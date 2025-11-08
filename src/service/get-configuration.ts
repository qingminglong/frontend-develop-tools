import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { configuration } from '../domain/get-configuration.ts'
import { ERROR_MESSAGES } from '../consts/index.ts'
import { createErrorResponse, createTextResponse } from '../utils/index.ts'

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
        return createTextResponse(JSON.stringify(configuration, null, 2))
      } catch (e) {
        const errorMsg =
          e instanceof Error ? e.message : ERROR_MESSAGES.UNKNOWN_ERROR
        return createErrorResponse(`Error: ${errorMsg}`, {
          isError: true,
          extraMessage: ERROR_MESSAGES.TASK_TERMINATION_NOTICE
        })
      }
    }
  )
}
