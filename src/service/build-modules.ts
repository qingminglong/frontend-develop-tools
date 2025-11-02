import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { buildModules } from '../domain/build-modules.ts'
import {
  BUILD_MODULES_SERVICE_MESSAGES,
  ERROR_MESSAGES
} from '../consts/index.ts'

/**
 * 全局互斥标志位：标识是否有编译操作正在执行
 */
let isBuildingInProgress = false

/**
 * 注册构建模块工具
 * 直接执行 buildModules 函数进行构建
 * 使用全局互斥标志位防止并发执行
 */
export function registerBuildModules(server: McpServer): void {
  server.registerTool(
    'build-modules',
    {
      title: 'build-modules',
      description: '执行模块构建任务',
      inputSchema: {}
    },
    async () => {
      try {
        // 检查是否有编译操作正在执行
        if (isBuildingInProgress) {
          console.error(
            BUILD_MODULES_SERVICE_MESSAGES.OPERATION_IN_PROGRESS_WARNING
          )
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message:
                      BUILD_MODULES_SERVICE_MESSAGES.OPERATION_IN_PROGRESS
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        // 设置互斥标志位
        isBuildingInProgress = true
        console.error(BUILD_MODULES_SERVICE_MESSAGES.TASK_START)

        return await new Promise((resolve) => {
          setTimeout(() => {
            const result = buildModules()

            console.error(
              result
                ? BUILD_MODULES_SERVICE_MESSAGES.TASK_SUCCESS_LOG
                : BUILD_MODULES_SERVICE_MESSAGES.TASK_FAILED_LOG
            )

            resolve({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: result,
                      message: result
                        ? BUILD_MODULES_SERVICE_MESSAGES.TASK_SUCCESS
                        : BUILD_MODULES_SERVICE_MESSAGES.TASK_FAILED
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
        console.error(BUILD_MODULES_SERVICE_MESSAGES.TASK_ERROR, e)
        return {
          content: [
            {
              type: 'text',
              text: `${BUILD_MODULES_SERVICE_MESSAGES.ERROR_PREFIX}${
                e instanceof Error ? e.message : ERROR_MESSAGES.UNKNOWN_ERROR
              }`
            }
          ],
          isError: true
        }
      } finally {
        // 无论成功还是失败，都重置互斥标志位
        isBuildingInProgress = false
        console.error(BUILD_MODULES_SERVICE_MESSAGES.TASK_END)
      }
    }
  )
}
