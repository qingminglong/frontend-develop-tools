import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { syncDesignModule } from '../domain/sync-design-module.ts'
import {
  clearLogBuffer,
  flushLogBuffer,
  createSuccessResponse,
  checkOperationInProgress,
  createDetailedErrorResponse,
  createExceptionErrorResponse
} from '../utils/index.ts'
import { SYNC_DESIGN_MODULE_SERVICE_MESSAGES } from '../consts/sync-design-module.ts'
import { ERROR_MESSAGES } from '../consts/index.ts'

/**
 * 全局互斥标志位：标识是否有同步设计模块操作正在执行
 */
let isSyncingDesignModule = false

/**
 * 重置全局变量
 * 用于清理进程退出或MCP被禁用时的互斥状态
 */
export function resetSyncDesignModuleServiceGlobals(): void {
  isSyncingDesignModule = false
}

/**
 * 注册同步设计模块工具
 * 用于同步设计态的静态资源文件到项目中
 * 使用全局互斥标志位防止并发执行
 */
export function registerSyncDesignModule(server: McpServer): void {
  server.registerTool(
    'sync-design-module',
    {
      title: 'sync-design-module',
      description: '执行构建任务并同步设计态的静态资源文件到项目中',
      inputSchema: {}
    },
    () => {
      try {
        // 检查是否有同步设计模块操作正在执行
        const inProgressCheck = checkOperationInProgress(
          isSyncingDesignModule,
          SYNC_DESIGN_MODULE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS_WARNING,
          SYNC_DESIGN_MODULE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS
        )
        if (inProgressCheck) {
          return inProgressCheck
        }

        // 设置互斥标志位
        isSyncingDesignModule = true
        console.error(SYNC_DESIGN_MODULE_SERVICE_MESSAGES.TASK_START)

        // 清空日志缓冲区，准备收集新的日志
        clearLogBuffer()

        // 调用 domain 中的 syncDesignModule 方法
        const isSuccess = syncDesignModule()

        console.error(
          isSuccess
            ? SYNC_DESIGN_MODULE_SERVICE_MESSAGES.TASK_SUCCESS_LOG
            : SYNC_DESIGN_MODULE_SERVICE_MESSAGES.TASK_FAILED_LOG
        )

        // 如果执行失败，使用 isError: true 标记，并包含详细的日志信息
        if (!isSuccess) {
          const detailedLogs = flushLogBuffer()
          return createDetailedErrorResponse(
            SYNC_DESIGN_MODULE_SERVICE_MESSAGES.TASK_FAILED,
            detailedLogs,
            ERROR_MESSAGES.TASK_TERMINATION_NOTICE
          )
        } else {
          // 成功时清空日志缓冲区
          flushLogBuffer()
          return createSuccessResponse(
            SYNC_DESIGN_MODULE_SERVICE_MESSAGES.TASK_SUCCESS
          )
        }
      } catch (e) {
        console.error(SYNC_DESIGN_MODULE_SERVICE_MESSAGES.TASK_ERROR, e)
        const detailedLogs = flushLogBuffer()
        return createExceptionErrorResponse(
          SYNC_DESIGN_MODULE_SERVICE_MESSAGES.ERROR_PREFIX,
          e,
          detailedLogs,
          ERROR_MESSAGES.TASK_TERMINATION_NOTICE
        )
      } finally {
        // 无论成功还是失败，都重置互斥标志位
        isSyncingDesignModule = false
        console.error(SYNC_DESIGN_MODULE_SERVICE_MESSAGES.TASK_END)
      }
    }
  )
}
