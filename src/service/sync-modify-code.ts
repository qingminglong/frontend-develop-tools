import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { syncModifyCode } from '../domain/sync-modify-code.ts'
import {
  SYNC_MODIFY_CODE_SERVICE_MESSAGES,
  ERROR_MESSAGES
} from '../consts/index.ts'

/**
 * 全局互斥标志位：标识是否有同步修改代码操作正在执行
 */
let isSyncModifyingInProgress = false

/**
 * 注册同步修改代码工具
 * 用于在代码修改后同步执行构建任务
 * 使用全局互斥标志位防止并发执行
 */
export function registerSyncModifyCode(server: McpServer): void {
  server.registerTool(
    'sync-modify-code',
    {
      title: 'sync-modify-code',
      description: '同步修改代码并执行构建任务',
      inputSchema: {}
    },
    async () => {
      try {
        // 检查是否有同步修改操作正在执行
        if (isSyncModifyingInProgress) {
          console.error(
            SYNC_MODIFY_CODE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS_WARNING
          )
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message:
                      SYNC_MODIFY_CODE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        // 设置互斥标志位
        isSyncModifyingInProgress = true
        console.error(SYNC_MODIFY_CODE_SERVICE_MESSAGES.TASK_START)

        return await new Promise((resolve) => {
          setTimeout(() => {
            // 调用 domain 中的 syncModifyCode 方法
            const result = syncModifyCode()

            console.error(
              result
                ? SYNC_MODIFY_CODE_SERVICE_MESSAGES.TASK_SUCCESS_LOG
                : SYNC_MODIFY_CODE_SERVICE_MESSAGES.TASK_FAILED_LOG
            )

            resolve({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: result,
                      message: result
                        ? SYNC_MODIFY_CODE_SERVICE_MESSAGES.TASK_SUCCESS
                        : SYNC_MODIFY_CODE_SERVICE_MESSAGES.TASK_FAILED
                    },
                    null,
                    2
                  )
                }
              ]
            })
          }, 0)
        })
      } catch (e) {
        console.error(SYNC_MODIFY_CODE_SERVICE_MESSAGES.TASK_ERROR, e)
        return {
          content: [
            {
              type: 'text',
              text: `${SYNC_MODIFY_CODE_SERVICE_MESSAGES.ERROR_PREFIX}${
                e instanceof Error ? e.message : ERROR_MESSAGES.UNKNOWN_ERROR
              }`
            }
          ],
          isError: true
        }
      } finally {
        // 无论成功还是失败，都重置互斥标志位
        isSyncModifyingInProgress = false
        console.error(SYNC_MODIFY_CODE_SERVICE_MESSAGES.TASK_END)
      }
    }
  )
}
