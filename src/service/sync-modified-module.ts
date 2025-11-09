import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { syncModifiedModule } from '../domain/sync-modified-module.ts'
import {
  detectChangedModulesForAllPaths,
  getModulesInfosDetail,
  clearAllModulesInfos
} from '../domain/detect-changed-module.ts'
import { getAllBuildedModules } from '../domain/build-modules.ts'
import { listModifedModules } from '../domain/sync-specified-module.ts'
import {
  clearLogBuffer,
  flushLogBuffer,
  createSuccessResponse,
  checkOperationInProgress,
  createDetailedErrorResponse,
  createExceptionErrorResponse
} from '../utils/index.ts'
import { SYNC_MODIFIED_MODULE_SERVICE_MESSAGES } from '../consts/sync-modified-module.ts'
import { ERROR_MESSAGES } from '../consts/index.ts'

/**
 * 全局互斥标志位：标识是否有同步修改代码操作正在执行
 */
let isSyncModifying = false

/**
 * 检查用户输入是否以list结尾
 * @param userInput - 用户输入字符串
 * @returns 是否以list结尾
 */
function isListCommand(userInput: string): boolean {
  if (!userInput || typeof userInput !== 'string') {
    return false
  }
  // 去除末尾的标点符号和空格，然后检查是否以list结尾
  const trimmed = userInput.trim().replace(/[.,!?;:]$/, '')
  const words = trimmed.split(/\s+/)
  return words.length > 0 && words[words.length - 1].toLowerCase() === 'list'
}

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
      inputSchema: {
        userInput: z
          .string()
          .optional()
          .describe(
            '用户输入，如果以list结尾则列出所有变更模块，否则从输入中提取模块名进行过滤'
          ),
        moduleName: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .describe(
            '直接指定模块名，可以是单个字符串或字符串数组，用于过滤变更模块'
          )
      }
    },
    (args: any) => {
      try {
        // 检查是否有同步修改操作正在执行
        const inProgressCheck = checkOperationInProgress(
          isSyncModifying,
          SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS_WARNING,
          SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.OPERATION_IN_PROGRESS
        )
        if (inProgressCheck) {
          return inProgressCheck
        }

        // 设置互斥标志位
        isSyncModifying = true
        console.error(SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_START)

        // 清空日志缓冲区，准备收集新的日志
        clearLogBuffer()

        // 检测变更的模块
        detectChangedModulesForAllPaths()

        // 处理模块过滤逻辑
        const userInput = args.userInput || ''
        const isListCmd = isListCommand(userInput)

        // 如果用户输入以list结尾，列出所有变更模块
        if (isListCmd) {
          console.error(
            'User input ends with "list", listing all changed modules'
          )
          listModifedModules()
          const detailedLogs = flushLogBuffer()
          return createSuccessResponse(
            `变更模块列表已显示${detailedLogs ? `\n${detailedLogs}` : ''}`
          )
        }

        // 检查是否有模块名参数需要过滤
        const moduleNames = args.moduleName
        const hasModuleNames =
          moduleNames &&
          ((Array.isArray(moduleNames) && moduleNames.length > 0) ||
            (typeof moduleNames === 'string' && moduleNames.trim() !== ''))

        if (hasModuleNames) {
          // 从输入中提取模块名列表
          const modulesToFilter = Array.isArray(moduleNames)
            ? moduleNames
            : [moduleNames]
          console.error(`Filtering modules to: ${modulesToFilter.join(', ')}`)

          // 获取检测到的所有模块信息
          const originalModulesDetail = getModulesInfosDetail()

          // 过滤出指定模块名的信息
          const filteredModulesDetail: Record<string, any[]> = {}

          for (const [projectPath, modules] of Object.entries(
            originalModulesDetail
          )) {
            const filteredModules = modules.filter((module) =>
              modulesToFilter.includes(module.moduleName)
            )
            if (filteredModules.length > 0) {
              filteredModulesDetail[projectPath] = filteredModules
            }
          }

          // 如果没有找到匹配的模块，返回错误
          const totalFilteredModules = Object.values(
            filteredModulesDetail
          ).flat().length
          if (totalFilteredModules === 0) {
            const detailedLogs = flushLogBuffer()
            const errorMessage = `未找到指定的模块: ${modulesToFilter.join(
              ', '
            )}${detailedLogs ? `\n${detailedLogs}` : ''}`
            return createDetailedErrorResponse(
              SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_FAILED,
              errorMessage,
              ERROR_MESSAGES.TASK_TERMINATION_NOTICE
            )
          }

          // 清除所有模块信息缓存，并设置过滤后的模块信息
          clearAllModulesInfos()
          // 重新设置过滤后的模块信息到全局缓存
          const allModulesDetail = getModulesInfosDetail()
          for (const [projectPath, modules] of Object.entries(
            filteredModulesDetail
          )) {
            allModulesDetail[projectPath] = modules
          }

          console.error(
            `Filtered to ${totalFilteredModules} modules from ${modulesToFilter.length} specified modules`
          )
        }

        // 获取所有已构建的模块
        getAllBuildedModules()

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
          return createDetailedErrorResponse(
            SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_FAILED,
            detailedLogs,
            ERROR_MESSAGES.TASK_TERMINATION_NOTICE
          )
        } else {
          // 成功时清空日志缓冲区
          flushLogBuffer()
          return createSuccessResponse(
            SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_SUCCESS
          )
        }
      } catch (e) {
        console.error(SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_ERROR, e)
        const detailedLogs = flushLogBuffer()
        return createExceptionErrorResponse(
          SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.ERROR_PREFIX,
          e,
          detailedLogs,
          ERROR_MESSAGES.TASK_TERMINATION_NOTICE
        )
      } finally {
        // 无论成功还是失败，都重置互斥标志位
        isSyncModifying = false
        console.error(SYNC_MODIFIED_MODULE_SERVICE_MESSAGES.TASK_END)
      }
    }
  )
}
