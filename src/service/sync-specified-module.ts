import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  syncSpecifiedModule,
  listAllModules
} from '../domain/sync-specified-module.ts'

import {
  clearLogBuffer,
  flushLogBuffer,
  createSuccessResponse,
  checkOperationInProgress,
  createTextResponse
} from '../utils/index.ts'
import { ERROR_MESSAGES, REGEX_PATTERNS } from '../consts/index.ts'
import { SYNC_SPECIFIED_MODULE_SERVICE_MESSAGES } from '../consts/sync-specified-module.ts'

/**
 * 全局互斥标志位：标识是否有同步单个模块操作正在执行
 */
let isSyncSingleModule = false

/**
 * 从用户输入中提取多个模块名
 * 支持多种格式：
 * - "同步@ida/ui和@ida/components模块下修改内容"
 * - "同步 @ida/ui @ida/components 模块下修改内容"
 * - "@ida/ui,@ida/components"
 * - "@ida/ui @ida/components"
 * @param userInput - 用户输入字符串
 * @returns 提取的模块名数组，如果未找到返回空数组
 */
function extractMultipleModuleNames(userInput: string): string[] {
  const modules: string[] = []

  // 首先尝试匹配所有 @scope/package-name 格式的包名
  const scopedPackageRegex = new RegExp(REGEX_PATTERNS.SCOPED_PACKAGE, 'g')
  let match
  while ((match = scopedPackageRegex.exec(userInput)) !== null) {
    modules.push(match[0])
  }

  // 如果没有找到 scoped package，尝试匹配普通包名
  if (modules.length === 0) {
    const simplePackageRegex = new RegExp(REGEX_PATTERNS.SIMPLE_PACKAGE, 'g')
    while ((match = simplePackageRegex.exec(userInput)) !== null) {
      if (match[1]) {
        modules.push(match[1])
      }
    }
  }

  // 去重并返回
  return [...new Set(modules)]
}

/**
 * 重置全局变量
 * 用于清理进程退出或MCP被禁用时的互斥状态
 */
export function resetSyncSpecifiedModuleServiceGlobals(): void {
  isSyncSingleModule = false
}

/**
 * 注册同步单个模块工具
 * 用于根据用户输入同步指定模块的修改内容
 * 使用全局互斥标志位防止并发执行
 */
export function registerSyncSpecifiedModule(server: McpServer): void {
  server.registerTool(
    'sync-specified-module',
    {
      title: 'sync-specified-module',
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
        const isNoModuleName =
          !args.moduleName ||
          (Array.isArray(args.moduleName) && args.moduleName.length === 0) ||
          (typeof args.moduleName === 'string' && args.moduleName.trim() === '')

        if (isNoModuleName) {
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
          SYNC_SPECIFIED_MODULE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS_WARNING,
          SYNC_SPECIFIED_MODULE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS
        )
        if (inProgressCheck) {
          return inProgressCheck
        }
        // 设置互斥标志位
        isSyncSingleModule = true
        console.error(SYNC_SPECIFIED_MODULE_SERVICE_MESSAGES.TASK_START)
        // 清空日志缓冲区，准备收集新的日志
        clearLogBuffer()

        // 处理模块名输入，支持多个模块
        let modulesToProcess: string[] = []

        if (args.moduleName) {
          if (typeof args.moduleName === 'string') {
            modulesToProcess = [args.moduleName]
          } else if (
            Array.isArray(args.moduleName) &&
            args.moduleName.length > 0
          ) {
            modulesToProcess = args.moduleName
          }
        } else if (args.userInput) {
          // 从 userInput 中提取模块名（可能包含多个）
          const extractedModules = extractMultipleModuleNames(args.userInput)
          if (extractedModules.length > 0) {
            modulesToProcess = extractedModules
          }
        }

        if (modulesToProcess.length === 0) {
          const detailedLogs = flushLogBuffer()
          const errorMessage = `${
            SYNC_SPECIFIED_MODULE_SERVICE_MESSAGES.TASK_FAILED
          }${ERROR_MESSAGES.UNABLE_TO_EXTRACT_MODULES}${
            detailedLogs
              ? `${ERROR_MESSAGES.DETAILED_ERROR_SECTION}${detailedLogs}`
              : ''
          }${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`

          return createTextResponse(errorMessage, true)
        }

        // 调用 domain 中的 syncSpecifiedModule 方法，支持多个模块
        const syncResult = syncSpecifiedModule(modulesToProcess)
        console.error(
          syncResult.success
            ? SYNC_SPECIFIED_MODULE_SERVICE_MESSAGES.TASK_SUCCESS_LOG
            : SYNC_SPECIFIED_MODULE_SERVICE_MESSAGES.TASK_FAILED_LOG
        )
        // 如果执行失败，使用 isError: true 标记，并包含详细的日志信息
        if (!syncResult.success) {
          const detailedLogs = flushLogBuffer()
          const errorMessage = `${
            SYNC_SPECIFIED_MODULE_SERVICE_MESSAGES.TASK_FAILED
          }${
            detailedLogs
              ? `${ERROR_MESSAGES.DETAILED_ERROR_SECTION}${detailedLogs}`
              : ''
          }${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`

          return createTextResponse(errorMessage, true)
        } else {
          // 成功时清空日志缓冲区
          flushLogBuffer()
          const successMessage = syncResult.partialSuccess
            ? `${SYNC_SPECIFIED_MODULE_SERVICE_MESSAGES.TASK_SUCCESS}\n${syncResult.message}`
            : SYNC_SPECIFIED_MODULE_SERVICE_MESSAGES.TASK_SUCCESS
          return createSuccessResponse(successMessage)
        }
      } catch (e) {
        console.error(SYNC_SPECIFIED_MODULE_SERVICE_MESSAGES.TASK_ERROR, e)
        const detailedLogs = flushLogBuffer()
        const errorMsg =
          e instanceof Error ? e.message : ERROR_MESSAGES.UNKNOWN_ERROR
        const fullErrorMessage = `${
          SYNC_SPECIFIED_MODULE_SERVICE_MESSAGES.ERROR_PREFIX
        }${errorMsg}${
          detailedLogs
            ? `${ERROR_MESSAGES.DETAILED_ERROR_SECTION}${detailedLogs}`
            : ''
        }${ERROR_MESSAGES.TASK_TERMINATION_NOTICE}`

        return createTextResponse(fullErrorMessage, true)
      } finally {
        // 无论成功还是失败，都重置互斥标志位
        isSyncSingleModule = false
        console.error(SYNC_SPECIFIED_MODULE_SERVICE_MESSAGES.TASK_END)
      }
    }
  )
}
