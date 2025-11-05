import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { syncDesignStaticAssets } from '../domain/sync-design-static-assets.ts'
import { clearLogBuffer, flushLogBuffer } from '../utils/index.ts'
import { SYNC_DESIGN_ASSETS_SERVICE_MESSAGES } from '../consts/sync-design-static-assets.ts'
import { ERROR_MESSAGES } from '../consts/index.ts'

/**
 * 全局互斥标志位：标识是否有同步静态资源操作正在执行
 */
let isSyncingAssetsInProgress = false

/**
 * 重置全局变量
 * 用于清理进程退出或MCP被禁用时的互斥状态
 */
export function resetSyncDesignStaticAssetsServiceGlobals(): void {
  isSyncingAssetsInProgress = false
}

/**
 * 注册同步设计态静态资源工具
 * 用于同步设计态的静态资源文件到项目中
 * 使用全局互斥标志位防止并发执行
 */
export function registerSyncDesignStaticAssets(server: McpServer): void {
  server.registerTool(
    'sync-design-static-assets',
    {
      title: 'sync-design-static-assets',
      description: '同步设计态的静态资源文件到项目中',
      inputSchema: {}
    },
    () => {
      try {
        // 检查是否有同步静态资源操作正在执行
        if (isSyncingAssetsInProgress) {
          console.error(
            SYNC_DESIGN_ASSETS_SERVICE_MESSAGES.OPERATION_IN_PROGRESS_WARNING
          )
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message:
                      SYNC_DESIGN_ASSETS_SERVICE_MESSAGES.OPERATION_IN_PROGRESS
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        // 设置互斥标志位
        isSyncingAssetsInProgress = true
        console.error(SYNC_DESIGN_ASSETS_SERVICE_MESSAGES.TASK_START)

        // 清空日志缓冲区，准备收集新的日志
        clearLogBuffer()

        // 调用 domain 中的 syncDesignStaticAssets 方法
        const result = syncDesignStaticAssets()

        console.error(
          result
            ? SYNC_DESIGN_ASSETS_SERVICE_MESSAGES.TASK_SUCCESS_LOG
            : SYNC_DESIGN_ASSETS_SERVICE_MESSAGES.TASK_FAILED_LOG
        )

        // 如果执行失败，使用 isError: true 标记，并包含详细的日志信息
        if (!result) {
          const detailedLogs = flushLogBuffer()
          const errorMessage = detailedLogs
            ? `${SYNC_DESIGN_ASSETS_SERVICE_MESSAGES.TASK_FAILED}${ERROR_MESSAGES.DETAILED_ERROR_SECTION}${detailedLogs}${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`
            : `${SYNC_DESIGN_ASSETS_SERVICE_MESSAGES.TASK_FAILED}${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`

          return {
            content: [
              {
                type: 'text',
                text: errorMessage
              }
            ],
            isError: true
          }
        } else {
          // 成功时清空日志缓冲区
          flushLogBuffer()
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    message: SYNC_DESIGN_ASSETS_SERVICE_MESSAGES.TASK_SUCCESS
                  },
                  null,
                  2
                )
              }
            ]
          }
        }
      } catch (e) {
        console.error(SYNC_DESIGN_ASSETS_SERVICE_MESSAGES.TASK_ERROR, e)
        const detailedLogs = flushLogBuffer()
        const errorMsg =
          e instanceof Error ? e.message : ERROR_MESSAGES.UNKNOWN_ERROR
        const fullErrorMessage = detailedLogs
          ? `${SYNC_DESIGN_ASSETS_SERVICE_MESSAGES.ERROR_PREFIX}${errorMsg}${ERROR_MESSAGES.DETAILED_ERROR_SECTION}${detailedLogs}${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`
          : `${SYNC_DESIGN_ASSETS_SERVICE_MESSAGES.ERROR_PREFIX}${errorMsg}${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`

        return {
          content: [
            {
              type: 'text',
              text: fullErrorMessage
            }
          ],
          isError: true
        }
      } finally {
        // 无论成功还是失败，都重置互斥标志位
        isSyncingAssetsInProgress = false
        console.error(SYNC_DESIGN_ASSETS_SERVICE_MESSAGES.TASK_END)
      }
    }
  )
}
