import { ERROR_MESSAGES } from '../consts/index.ts'

/**
 * 日志输出工具函数
 * 用于将日志输出到 Cursor 聊天页面（通过 stderr）
 */

/**
 * 全局日志缓冲区，用于收集日志消息
 */
let logBuffer: string[] = []

/**
 * 输出日志到 Cursor 聊天页面
 * @param message - 日志消息
 * @param args - 额外的参数
 */
export function logToChat(message: string, ...args: any[]): void {
  const fullMessage =
    args.length > 0
      ? `${message} ${args
          .map((arg) =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          )
          .join(' ')}`
      : message
  console.error(fullMessage)
  logBuffer.push(fullMessage)
}

/**
 * 输出空行到 Cursor 聊天页面
 */
export function logEmptyLine(): void {
  console.error()
  logBuffer.push('')
}

/**
 * 获取所有收集的日志消息
 * @returns 日志消息数组
 */
export function getLogBuffer(): string[] {
  return [...logBuffer]
}

/**
 * 清空日志缓冲区
 */
export function clearLogBuffer(): void {
  logBuffer = []
}

/**
 * 获取日志缓冲区内容并清空
 * @returns 日志消息字符串（用换行符连接）
 */
export function flushLogBuffer(): string {
  const logs = logBuffer.join('\n')
  clearLogBuffer()
  return logs
}

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
