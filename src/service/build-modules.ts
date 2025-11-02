import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { buildModules } from '../domain/build-modules.ts'

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
          console.error('⚠️  有编译操作正在执行，请等待上次编译完成再尝试')
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message: '有编译操作正在执行，请等待上次编译完成再尝试'
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
        console.error('🔨 开始执行构建任务...')

        return await new Promise((resolve) => {
          setTimeout(() => {
            const result = buildModules()

            console.error(
              result ? '✅ 构建任务执行成功' : '❌ 构建任务执行失败'
            )

            resolve({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: result,
                      message: result ? '构建任务执行成功' : '构建任务执行失败'
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
        console.error('❌ 构建任务执行出错:', e)
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
        isBuildingInProgress = false
        console.error('🏁 构建任务结束，释放互斥锁')
      }
    }
  )
}
