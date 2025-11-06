import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { syncModifiedModule } from '../domain/sync-modified-module.ts'
import {
  clearLogBuffer,
  flushLogBuffer,
  createErrorResponse
} from '../utils/index.ts'
import { SYNC_MODIFIED_MODULE_SERVICE_MESSAGES } from '../consts/sync-modified-module.ts'
import { ERROR_MESSAGES } from '../consts/index.ts'

/**
 * 全局互斥标志位：标识是否有同步修改代码操作正在执行
 */
let isSyncModifying = false

/**
 * 重置全局变量
 * 用于清理进程退出或MCP被禁用时的互斥状态
 */
export function resetSyncModifyCodeServiceGlobals(): void {
  isSyncModifying = false
}

/**
 * 注册同步修改代码工具
 * 用于在代码修改后同步执行构建任务
 * 使用全局互斥标志位防止并发执行
 */
export function registerSyncModifyCode(server: McpServer): void {
  server.registerTool(
    'sync-modified-code',
    {
      title: 'sync-modified-code',
      description: '执行构建任务并同步修改的代码',
      inputSchema: {}
    },
    () => {
      try {
        // 检查是否有同步修改操作正在执行
        if (isSyncModifying) {
          console.error(
            SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS_WARNING
          )
          return createErrorResponse(
            SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS
          )
        }

        // 设置互斥标志位
        isSyncModifying = true
        console.error(SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_START)

        // 清空日志缓冲区，准备收集新的日志
        clearLogBuffer()

        // 调用 domain 中的 syncModifiedModule 方法
        const result = syncModifiedModule()

        console.error(
          result
            ? SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_SUCCESS_LOG
            : SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_FAILED_LOG
        )

        // 如果执行失败，使用 isError: true 标记，并包含详细的日志信息
        if (!result) {
          const detailedLogs = flushLogBuffer()
          const errorMessage = detailedLogs
            ? `${SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_FAILED}${ERROR_MESSAGES.DETAILED_ERROR_SECTION}${detailedLogs}${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`
            : `${SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_FAILED}${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`

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
                    message: SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_SUCCESS
                  },
                  null,
                  2
                )
              }
            ]
          }
        }
      } catch (e) {
        console.error(SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_ERROR, e)
        const detailedLogs = flushLogBuffer()
        const errorMsg =
          e instanceof Error ? e.message : ERROR_MESSAGES.UNKNOWN_ERROR
        const fullErrorMessage = detailedLogs
          ? `${SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.ERROR_PREFIX}${errorMsg}${ERROR_MESSAGES.DETAILED_ERROR_SECTION}${detailedLogs}${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`
          : `${SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.ERROR_PREFIX}${errorMsg}${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`

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
        isSyncModifying = false
        console.error(SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_END)
      }
    }
  )
}
