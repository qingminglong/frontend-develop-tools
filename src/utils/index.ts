import { ERROR_MESSAGES } from '../consts/index.ts'
import path from 'path'
import fs from 'fs'
import yaml from 'js-yaml'
import type { WorkspaceConfig } from '../types/detect-changed-module.ts'
import {
  FILE_NAMES,
  ENCODINGS,
  PACKAGE_FIELDS,
  SPECIAL_CHARS
} from '../consts/index.ts'
export {
  logToChat,
  logEmptyLine,
  getLogBuffer,
  clearLogBuffer,
  flushLogBuffer,
  formatMessage
} from './logger.ts'

/**
 * 创建成功响应的工具函数
 * @param message - 成功消息
 * @param indent - JSON格式化的缩进空格数，默认为2
 * @returns MCP工具响应格式的成功内容
 */
export function createSuccessResponse(
  message: string,
  indent: number = 2
): any {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            message
          },
          null,
          indent
        )
      }
    ]
  }
}

/**
 * 检查操作是否正在进行中，如果是则返回错误响应
 * @param isInProgress - 是否正在进行中的标志
 * @param warningMessage - 警告消息
 * @param errorMessage - 错误消息
 * @returns 如果正在进行中则返回错误响应，否则返回null
 */
export function checkOperationInProgress(
  isInProgress: boolean,
  warningMessage: string,
  errorMessage: string
): any | null {
  if (isInProgress) {
    console.error(warningMessage)
    return createErrorResponse(errorMessage)
  }
  return null
}

/**
 * 创建简单错误响应的工具函数
 * @param message - 错误消息（纯文本格式）
 * @returns MCP工具响应格式的简单错误内容
 */
export function createSimpleErrorResponse(message: string): any {
  return {
    content: [
      {
        type: 'text',
        text: message
      }
    ],
    isError: true
  }
}

/**
 * 创建错误响应的工具函数
 * @param message - 错误消息
 * @param options - 可选配置
 * @param options.indent - JSON格式化的缩进空格数，默认为2
 * @param options.isError - 是否标记为错误，默认为false
 * @param options.extraMessage - 附加的消息，会拼接到message后面
 * @returns MCP工具响应格式的错误内容
 */
export function createErrorResponse(
  message: string,
  options: {
    indent?: number
    isError?: boolean
    extraMessage?: string
  } = {}
): any {
  const { indent = 2, isError = false, extraMessage = '' } = options
  const fullMessage = extraMessage ? `${message}${extraMessage}` : message

  const response: any = {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: false,
            message: fullMessage
          },
          null,
          indent
        )
      }
    ]
  }

  if (isError) {
    response.isError = true
  }

  return response
}

/**
 * 创建包含详细日志的错误响应
 * @param message - 错误消息
 * @param detailedLogs - 详细的日志信息
 * @param taskTerminationNotice - 任务终止通知消息
 * @returns MCP工具响应格式的错误内容
 */
export function createDetailedErrorResponse(
  message: string,
  detailedLogs: string,
  taskTerminationNotice: string
): any {
  const errorMessage = detailedLogs
    ? `${message}\n${detailedLogs}${taskTerminationNotice}`
    : `${message}${taskTerminationNotice}`

  return {
    content: [
      {
        type: 'text',
        text: errorMessage
      }
    ],
    isError: true
  }
}

/**
 * 创建简单文本响应的工具函数
 * @param text - 响应文本内容
 * @param isError - 是否标记为错误，默认为false
 * @returns MCP工具响应格式的文本内容
 */
export function createTextResponse(
  text: string,
  isError: boolean = false
): any {
  const response: any = {
    content: [
      {
        type: 'text',
        text
      }
    ]
  }

  if (isError) {
    response.isError = true
  }

  return response
}

/**
 * 创建包含异常处理详细信息的错误响应
 * @param errorPrefix - 错误前缀消息
 * @param error - 错误对象
 * @param detailedLogs - 详细的日志信息
 * @param taskTerminationNotice - 任务终止通知消息
 * @returns MCP工具响应格式的错误内容
 */
export function createExceptionErrorResponse(
  errorPrefix: string,
  error: unknown,
  detailedLogs: string,
  taskTerminationNotice: string
): any {
  const errorMsg =
    error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR
  const fullErrorMessage = detailedLogs
    ? `${errorPrefix}${errorMsg}\n${detailedLogs}${taskTerminationNotice}`
    : `${errorPrefix}${errorMsg}${taskTerminationNotice}`

  return {
    content: [
      {
        type: 'text',
        text: fullErrorMessage
      }
    ],
    isError: true
  }
}

/**
 * 解析 workspace 配置文件，返回包含和排除模式
 * @param modulePath - 项目根目录路径
 * @returns 包含 includePatterns 和 excludePatterns 的对象
 */
export function parseWorkspacePatterns(modulePath: string): {
  includeModules: string[]
  excludeModules: string[]
} {
  const workspaceFile = path.join(modulePath, FILE_NAMES.WORKSPACE_CONFIG)
  // 如果不存在workspace文件，返回空数组
  if (!fs.existsSync(workspaceFile)) {
    return {
      includeModules: [],
      excludeModules: []
    }
  }
  const content = fs.readFileSync(workspaceFile, ENCODINGS.UTF8)
  const config = yaml.load(content) as WorkspaceConfig

  // 分离包含模式和排除模式
  const includeModules: string[] = []
  const excludeModules: string[] = []

  config[PACKAGE_FIELDS.PACKAGES].forEach((pattern: string) => {
    if (pattern.startsWith(SPECIAL_CHARS.EXCLAMATION)) {
      // 排除模式，去掉前缀的 '!'
      excludeModules.push(pattern.slice(1))
    } else {
      // 包含模式
      includeModules.push(pattern)
    }
  })

  return {
    includeModules,
    excludeModules
  }
}

// 重新导出从 handle.ts 导入的函数
export {
  ensureProjectDependencies,
  copyDirectory,
  findPnpmModulePath
} from './handle.ts'
