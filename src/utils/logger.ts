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

export function logToStderr(message: string, ...args: any[]): void {
  const fullMessage =
    args.length > 0
      ? `${message} ${args
          .map((arg) =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          )
          .join(' ')}`
      : message
  process.stderr.write('[stderr] ' + fullMessage + '\n')
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
 * 替换消息模板中的占位符
 * @param template - 消息模板
 * @param params - 参数对象
 * @returns 替换后的消息
 */
export function formatMessage(
  template: string,
  params: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
}
