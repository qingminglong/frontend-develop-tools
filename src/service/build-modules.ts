import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { buildModules } from '../domain/build-modules.ts'
import {
  clearLogBuffer,
  flushLogBuffer,
  createSuccessResponse,
  checkOperationInProgress,
  createDetailedErrorResponse,
  createExceptionErrorResponse
} from '../utils/index.ts'
import {
  BUILD_MODULES_SERVICE_MESSAGES,
  ERROR_MESSAGES
} from '../consts/index.ts'

/**
 * 全局互斥标志位：标识是否有编译操作正在执行
 */
let isBuildingInProgress = false

/**
 * 重置全局变量
 * 用于清理进程退出或MCP被禁用时的互斥状态
 */
export function resetBuildModulesServiceGlobals(): void {
  isBuildingInProgress = false
}

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
    () => {
      try {
        // 检查是否有编译操作正在执行
        const inProgressCheck = checkOperationInProgress(
          isBuildingInProgress,
          BUILD_MODULES_SERVICE_MESSAGES.OPERATION_IN_PROGRESS_WARNING,
          BUILD_MODULES_SERVICE_MESSAGES.OPERATION_IN_PROGRESS
        )
        if (inProgressCheck) {
          return inProgressCheck
        }

        // 设置互斥标志位
        isBuildingInProgress = true
        console.error(BUILD_MODULES_SERVICE_MESSAGES.TASK_START)

        // 清空日志缓冲区，准备收集新的日志
        clearLogBuffer()

        const result = buildModules()

        console.error(
          result
            ? BUILD_MODULES_SERVICE_MESSAGES.TASK_SUCCESS_LOG
            : BUILD_MODULES_SERVICE_MESSAGES.TASK_FAILED_LOG
        )

        // 如果执行失败，使用 isError: true 标记，并包含详细的日志信息
        if (!result) {
          const detailedLogs = flushLogBuffer()
          return createDetailedErrorResponse(
            BUILD_MODULES_SERVICE_MESSAGES.TASK_FAILED,
            detailedLogs,
            ERROR_MESSAGES.TASK_TERMINATION_NOTICE
          )
        } else {
          // 成功时清空日志缓冲区
          flushLogBuffer()
          return createSuccessResponse(
            BUILD_MODULES_SERVICE_MESSAGES.TASK_SUCCESS
          )
        }
      } catch (e) {
        console.error(BUILD_MODULES_SERVICE_MESSAGES.TASK_ERROR, e)
        const detailedLogs = flushLogBuffer()
        return createExceptionErrorResponse(
          BUILD_MODULES_SERVICE_MESSAGES.ERROR_PREFIX,
          e,
          detailedLogs,
          ERROR_MESSAGES.TASK_TERMINATION_NOTICE
        )
      } finally {
        // 无论成功还是失败，都重置互斥标志位
        isBuildingInProgress = false
        console.error(BUILD_MODULES_SERVICE_MESSAGES.TASK_END)
      }
    }
  )
}
