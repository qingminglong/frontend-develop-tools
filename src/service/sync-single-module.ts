import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { syncSingleModule } from '../domain/sync-single-module.ts'
import { clearLogBuffer, flushLogBuffer } from '../utils/index.ts'
import { ERROR_MESSAGES } from '../consts/index.ts'

/**
 * 全局互斥标志位：标识是否有同步单个模块操作正在执行
 */
let isSyncSingleModuleInProgress = false

/**
 * 同步单个模块服务层消息常量
 */
const SYNC_SINGLE_MODULE_SERVICE_MESSAGES = {
  // 互斥控制相关
  OPERATION_IN_PROGRESS_WARNING:
    '⚠️ 有同步单个模块操作正在执行，请等待上次操作完成再尝试',
  OPERATION_IN_PROGRESS: '有同步单个模块操作正在执行，请等待上次操作完成再尝试',

  // 任务执行相关
  TASK_START: '🔄 开始执行同步单个模块任务...',
  TASK_SUCCESS_LOG: '✅ 同步单个模块任务执行成功',
  TASK_FAILED_LOG: '❌ 同步单个模块任务执行失败',
  TASK_SUCCESS: '同步单个模块任务执行成功',
  TASK_FAILED: '同步单个模块任务执行失败',
  TASK_ERROR: '❌ 同步单个模块任务执行出错:',
  TASK_END: '🏁 同步单个模块任务结束，释放互斥锁',

  // 错误消息前缀
  ERROR_PREFIX: 'Error: ',

  // 输入验证
  MISSING_INPUT:
    '缺少必需参数：userInput。请提供包含模块名的输入，例如："同步@ida/ui模块下修改内容"',
  INVALID_INPUT: 'userInput 参数必须是非空字符串'
} as const

/**
 * 注册同步单个模块工具
 * 用于根据用户输入同步指定模块的修改内容
 * 使用全局互斥标志位防止并发执行
 */
export function registerSyncSingleModule(server: McpServer): void {
  server.registerTool(
    'sync-single-module',
    {
      title: 'sync-single-module',
      description:
        '同步指定模块的修改内容并执行构建任务。从用户输入中提取模块名（如"同步@ida/ui模块下修改内容"），在配置的模块路径中查找对应的模块，然后执行构建和同步。参数：userInput (string, 必需) - 包含模块名的用户输入。',
      inputSchema: {}
    },
    async (args: any) => {
      try {
        // 验证输入参数
        if (!args.userInput) {
          console.error(SYNC_SINGLE_MODULE_SERVICE_MESSAGES.MISSING_INPUT)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message: SYNC_SINGLE_MODULE_SERVICE_MESSAGES.MISSING_INPUT
                  },
                  null,
                  2
                )
              }
            ],
            isError: true
          }
        }

        if (
          typeof args.userInput !== 'string' ||
          args.userInput.trim().length === 0
        ) {
          console.error(SYNC_SINGLE_MODULE_SERVICE_MESSAGES.INVALID_INPUT)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message: SYNC_SINGLE_MODULE_SERVICE_MESSAGES.INVALID_INPUT
                  },
                  null,
                  2
                )
              }
            ],
            isError: true
          }
        }

        // 检查是否有同步单个模块操作正在执行
        if (isSyncSingleModuleInProgress) {
          console.error(
            SYNC_SINGLE_MODULE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS_WARNING
          )
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message:
                      SYNC_SINGLE_MODULE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        // 设置互斥标志位
        isSyncSingleModuleInProgress = true
        console.error(SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_START)

        // 清空日志缓冲区，准备收集新的日志
        clearLogBuffer()

        return await new Promise((resolve) => {
          setTimeout(() => {
            // 调用 domain 中的 syncSingleModule 方法
            const result = syncSingleModule(args.userInput!)

            console.error(
              result
                ? SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_SUCCESS_LOG
                : SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_FAILED_LOG
            )

            // 如果执行失败，使用 isError: true 标记，并包含详细的日志信息
            if (!result) {
              const detailedLogs = flushLogBuffer()
              const errorMessage = detailedLogs
                ? `${SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_FAILED}${ERROR_MESSAGES.DETAILED_ERROR_SECTION}${detailedLogs}${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`
                : `${SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_FAILED}${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`

              resolve({
                content: [
                  {
                    type: 'text',
                    text: errorMessage
                  }
                ],
                isError: true
              })
            } else {
              // 成功时清空日志缓冲区
              flushLogBuffer()
              resolve({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        success: true,
                        message:
                          SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_SUCCESS
                      },
                      null,
                      2
                    )
                  }
                ]
              })
            }
          }, 0)
        })
      } catch (e) {
        console.error(SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_ERROR, e)
        const detailedLogs = flushLogBuffer()
        const errorMsg =
          e instanceof Error ? e.message : ERROR_MESSAGES.UNKNOWN_ERROR
        const fullErrorMessage = detailedLogs
          ? `${SYNC_SINGLE_MODULE_SERVICE_MESSAGES.ERROR_PREFIX}${errorMsg}${ERROR_MESSAGES.DETAILED_ERROR_SECTION}${detailedLogs}${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`
          : `${SYNC_SINGLE_MODULE_SERVICE_MESSAGES.ERROR_PREFIX}${errorMsg}${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`

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
        isSyncSingleModuleInProgress = false
        console.error(SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_END)
      }
    }
  )
}
