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
