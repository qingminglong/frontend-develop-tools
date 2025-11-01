// MCP - NODE SDK
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// 导入 StdioServerTransport 类，用于处理服务器的输入输出通信
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import type { FSWatcher } from 'chokidar'
import { startWatchingModules } from './domain/start-watch'
import { stopWatchingModules } from './domain/stop-watch'

// 导入所有服务注册函数
import {
  registerGetConfiguration,
  registerCheckConfiguration,
  registerStartWatchModules,
  registerStopWatchModules,
  registerGetWatchStatus
} from './service/index'

/**
 * 全局监控器存储
 */
const watchers: Map<string, FSWatcher> = new Map()

/**
 * 定义了 MCP Server 实例。
 */
const server = new McpServer({
  name: 'frontend-develop-tools',
  version: '1.0.0'
})

// 根据 autoWatcher 环境变量决定是否自动启动模块监控
const autoWatcher = process.env.autoWatcher
if (autoWatcher !== 'false') {
  startWatchingModules(watchers)
  process.on('SIGINT', () => {
    stopWatchingModules(watchers)
    process.exit(0)
  })
}

// 注册所有工具
registerGetConfiguration(server)
registerCheckConfiguration(server)
registerGetWatchStatus(server, watchers)

// 只有在手动模式下才注册启动/停止监控工具
if (autoWatcher === 'false') {
  registerStartWatchModules(server, watchers)
  registerStopWatchModules(server, watchers)
}

/**
 * 启动服务器并建立与传输层的连接。
 * 该函数创建一个标准输入输出的服务器传输实例，
 * 并使用该实例将服务器连接到传输层。
 */
const transport = new StdioServerTransport()

// 等待服务器通过指定的传输实例建立连接
await server.connect(transport)
