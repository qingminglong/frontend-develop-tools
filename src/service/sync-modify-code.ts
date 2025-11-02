import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { syncModifyCode } from '../domain/sync-modify-code.ts'

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
          console.error('⚠️  有同步修改操作正在执行，请等待上次操作完成再尝试')
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message: '有同步修改操作正在执行，请等待上次操作完成再尝试'
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
        console.error('🔄 开始执行同步修改代码任务...')

        return await new Promise((resolve) => {
          setTimeout(() => {
            // 调用 domain 中的 syncModifyCode 方法
            const result = syncModifyCode()

            console.error(
              result
                ? '✅ 同步修改代码任务执行成功'
                : '❌ 同步修改代码任务执行失败'
            )

            resolve({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: result,
                      message: result
                        ? '同步修改代码任务执行成功'
                        : '同步修改代码任务执行失败'
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
        console.error('❌ 同步修改代码任务执行出错:', e)
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`
            }
          ],
          isError: true
        }
      } finally {
        // 无论成功还是失败，都重置互斥标志位
        isSyncModifyingInProgress = false
        console.error('🏁 同步修改代码任务结束，释放互斥锁')
      }
    }
  )
}
