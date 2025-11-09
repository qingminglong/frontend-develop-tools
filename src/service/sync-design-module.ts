import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { syncDesignModule } from '../domain/sync-design-module.ts'
import {
  getDesignBuildModules,
  getCachedStaticBuildModules,
  setCachedStaticBuildModules
} from '../domain/build-design-modules.ts'

import {
  clearLogBuffer,
  flushLogBuffer,
  createSuccessResponse,
  checkOperationInProgress,
  createDetailedErrorResponse,
  createExceptionErrorResponse,
  logToChat
} from '../utils/index.ts'
import { SYNC_DESIGN_MODULE_SERVICE_MESSAGES } from '../consts/sync-design-module.ts'
import { ERROR_MESSAGES } from '../consts/index.ts'

/**
 * 全局互斥标志位：标识是否有同步设计模块操作正在执行
 */
let isSyncingDesignModule = false

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
 * 列出设计模块
 * 从 getDesignBuildModules() 获取并显示所有设计模块
 */
function listDesignModules(): void {
  const modules = getDesignBuildModules()

  if (modules.length === 0) {
    logToChat('未找到设计模块')
    return
  }

  logToChat('设计模块列表:')

  modules.forEach((module, index) => {
    const reasonText =
      module.reason === 'changed'
        ? '直接变更'
        : `被依赖 (${module.dependedBy?.join(', ') ?? ''})`
    logToChat(`   ${index + 1}. ${module.moduleName} - ${reasonText}`)
  })
}

// 全局变量：存储模块过滤器
let moduleFilter: string[] | null = null

/**
 * 处理模块过滤逻辑
 * @param moduleNames - 要过滤的模块名，可以是字符串或字符串数组
 * @returns 如果过滤成功返回 null，继续执行；如果出错返回错误响应
 */
function handleModuleFiltering(
  moduleNames: string | string[] | undefined
): any {
  // 检查是否有模块名参数需要过滤
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

    // 设置全局过滤器，在getDesignBuildModules调用后应用
    moduleFilter = modulesToFilter
  }

  // 如果没有模块过滤或过滤成功，返回 null 表示继续执行
  return null
}

/**
 * 应用模块过滤器到缓存的设计模块
 * @returns 如果过滤成功返回 null，继续执行；如果出错返回错误响应
 */
function applyModuleFilter(): any {
  if (!moduleFilter) {
    return null // 没有过滤器，直接返回null表示继续
  }

  const originalModules = getCachedStaticBuildModules()

  // 过滤出指定模块名的信息
  const filteredModules = originalModules.filter((module: any) =>
    moduleFilter!.includes(module.moduleName)
  )

  // 如果没有找到匹配的模块，返回错误响应
  if (filteredModules.length === 0) {
    const detailedLogs = flushLogBuffer()
    const errorMessage = `未找到指定的模块: ${moduleFilter.join(', ')}${
      detailedLogs ? `\n${detailedLogs}` : ''
    }`
    // 重置过滤器
    moduleFilter = null
    return createDetailedErrorResponse(
      SYNC_DESIGN_MODULE_SERVICE_MESSAGES.TASK_FAILED,
      errorMessage,
      ERROR_MESSAGES.TASK_TERMINATION_NOTICE
    )
  }

  // 设置过滤后的缓存
  setCachedStaticBuildModules(filteredModules)

  console.error(
    `Filtered to ${filteredModules.length} modules from ${moduleFilter.length} specified modules`
  )

  // 重置过滤器
  moduleFilter = null
  return null
}

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
      inputSchema: {
        userInput: z
          .string()
          .optional()
          .describe(
            '用户输入，如果以list结尾则列出所有设计模块，否则从输入中提取模块名进行过滤'
          ),
        moduleName: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .describe(
            '直接指定模块名，可以是单个字符串或字符串数组，用于过滤设计模块'
          )
      }
    },
    (args: any) => {
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

        // 获取需要构建的模块列表
        getDesignBuildModules()

        // 处理模块过滤逻辑
        const userInput = args.userInput || ''
        const isListCmd = isListCommand(userInput)

        // 如果用户输入以list结尾，列出所有设计模块
        if (isListCmd) {
          console.error(
            'User input ends with "list", listing all design modules'
          )
          // 列出设计模块
          listDesignModules()
          const detailedLogs = flushLogBuffer()
          return createSuccessResponse(
            `设计模块列表已显示${detailedLogs ? `\n${detailedLogs}` : ''}`
          )
        }

        // 处理模块过滤逻辑
        const filterResult = handleModuleFiltering(args.moduleName)
        if (filterResult) {
          return filterResult
        }

        // 应用模块过滤器
        const applyResult = applyModuleFilter()
        if (applyResult) {
          return applyResult
        }

        // ****调用 domain 中的 syncDesignModule 方法****
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
