import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as fs from 'fs'
import { configuration } from '../domain/get-configuration.ts'
import { ERROR_MESSAGES } from '../consts/index.ts'
import { createErrorResponse, createTextResponse } from '../utils/index.ts'

/**
 * 注册检查配置路径工具
 */
export function registerCheckConfiguration(server: McpServer): void {
  server.registerTool(
    'check-configuration',
    {
      title: 'check-configuration',
      description: '检查配置的模块路径和项目路径是否存在',
      inputSchema: {}
    },
    async () => {
      try {
        const modulePathsStatus = configuration.modulePaths.map((p) => ({
          path: p,
          exists: fs.existsSync(p),
          isDirectory: fs.existsSync(p) ? fs.statSync(p).isDirectory() : false
        }))

        const projectPathsStatus = configuration.projectPaths.map((p) => ({
          path: p,
          exists: fs.existsSync(p),
          isDirectory: fs.existsSync(p) ? fs.statSync(p).isDirectory() : false
        }))

        const result = {
          modulePaths: modulePathsStatus,
          projectPaths: projectPathsStatus
        }

        return createTextResponse(JSON.stringify(result, null, 2))
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
