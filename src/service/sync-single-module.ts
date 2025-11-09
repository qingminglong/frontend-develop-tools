import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { syncSingleModule } from '../domain/sync-single-module.ts'

// 导入 listAllModules 函数（由于它是内部函数，我们需要一个包装函数）
function listAllModules() {
  // 这里需要调用 domain 中的 listAllModules 函数
  // 但是它是内部函数，我们需要导出一个包装函数
}
import {
  clearLogBuffer,
  flushLogBuffer,
  createSuccessResponse,
  checkOperationInProgress,
  createTextResponse
} from '../utils/index.ts'
import { ERROR_MESSAGES } from '../consts/index.ts'
import { SYNC_SINGLE_MODULE_SERVICE_MESSAGES } from '../consts/sync-single-module.ts'

/**
 * 全局互斥标志位：标识是否有同步单个模块操作正在执行
 */
let isSyncSingleModule = false

/**
 * 重置全局变量
 * 用于清理进程退出或MCP被禁用时的互斥状态
 */
export function resetSyncSingleModuleServiceGlobals(): void {
  isSyncSingleModule = false
}

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
        '执行构建任务并同步指定模块。从用户输入中提取模块名（如"执行构建任务并同步指定模块@ida/ui"）。',
      inputSchema: {
        userInput: z
          .string()
          .optional()
          .describe(
            '包含模块名的用户输入，例如："执行构建任务并同步指定模块@ida/ui"'
          ),
        moduleName: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .describe(
            '直接指定模块名，可以是单个字符串或字符串数组，为空时将列出所有可用模块'
          )
      }
    },
    (args: any) => {
      try {
        // 检查 moduleName 参数是否为空或空数组
        const isModuleNameEmpty =
          !args.moduleName ||
          (Array.isArray(args.moduleName) && args.moduleName.length === 0) ||
          (typeof args.moduleName === 'string' && args.moduleName.trim() === '')

        if (isModuleNameEmpty) {
          // 如果 moduleName 为空，列出所有可用模块
          console.error('ModuleName is empty, listing all modules')
          clearLogBuffer()
          listAllModules()
          const detailedLogs = flushLogBuffer()
          return createSuccessResponse(
            `模块列表已显示${detailedLogs ? `\n${detailedLogs}` : ''}`
          )
        }

        // 检查是否有同步单个模块操作正在执行
        const inProgressCheck = checkOperationInProgress(
          isSyncSingleModule,
          SYNC_SINGLE_MODULE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS_WARNING,
          SYNC_SINGLE_MODULE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS
        )
        if (inProgressCheck) {
          return inProgressCheck
        }
        // 设置互斥标志位
        isSyncSingleModule = true
        console.error(SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_START)
        // 清空日志缓冲区，准备收集新的日志
        clearLogBuffer()

        // 优先使用 moduleName 参数，否则从 userInput 中提取
        let inputToProcess = args.userInput || ''
        if (args.moduleName && typeof args.moduleName === 'string') {
          inputToProcess = args.moduleName
        } else if (
          Array.isArray(args.moduleName) &&
          args.moduleName.length > 0
        ) {
          inputToProcess = args.moduleName[0] // 暂时只处理第一个模块名
        }

        // 调用 domain 中的 syncSingleModule 方法
        const result = syncSingleModule(inputToProcess)
        console.error(
          result
            ? SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_SUCCESS_LOG
            : SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_FAILED_LOG
        )
        // 如果执行失败，使用 isError: true 标记，并包含详细的日志信息
        if (!result) {
          const detailedLogs = flushLogBuffer()
          const errorMessage = `${
            SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_FAILED
          }${
            detailedLogs
              ? `${ERROR_MESSAGES.DETAILED_ERROR_SECTION}${detailedLogs}`
              : ''
          }${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`

          return createTextResponse(errorMessage, true)
        } else {
          // 成功时清空日志缓冲区
          flushLogBuffer()
          return createSuccessResponse(
            SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_SUCCESS
          )
        }
      } catch (e) {
        console.error(
          '🚀 ~ registerSyncSingleModule ~ args.userInput error:',
          args.userInput
        )
        console.error(SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_ERROR, e)
        const detailedLogs = flushLogBuffer()
        const errorMsg =
          e instanceof Error ? e.message : ERROR_MESSAGES.UNKNOWN_ERROR
        const fullErrorMessage = `${
          SYNC_SINGLE_MODULE_SERVICE_MESSAGES.ERROR_PREFIX
        }${errorMsg}${
          detailedLogs
            ? `${ERROR_MESSAGES.DETAILED_ERROR_SECTION}${detailedLogs}`
            : ''
        }${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`

        return createTextResponse(fullErrorMessage, true)
      } finally {
        // 无论成功还是失败，都重置互斥标志位
        isSyncSingleModule = false
        console.error(SYNC_SINGLE_MODULE_SERVICE_MESSAGES.TASK_END)
        console.error(
          '🚀 ~ registerSyncSingleModule ~ args.userInput:',
          args.userInput
        )
      }
    }
  )
}
