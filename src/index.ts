// MCP - NODE SDK
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// 导入 StdioServerTransport 类，用于处理服务器的输入输出通信
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import type { FSWatcher } from 'chokidar'
import { startWatchingModules } from './domain/start-watch.ts'
import { stopWatchingModules } from './domain/stop-watch.ts'

// 导入所有重置全局变量的函数
import { resetBuildModulesGlobals } from './domain/build-modules.ts'
import { resetSyncSingleModuleGlobals } from './domain/sync-single-module.ts'
import { resetWatchModulesGlobals } from './domain/watch-modules.ts'
import { resetSyncSingleModuleServiceGlobals } from './service/sync-single-module.ts'
import { resetSyncDesignStaticAssetsServiceGlobals } from './service/sync-design-static-assets.ts'
import { resetBuildModulesServiceGlobals } from './service/build-modules.ts'
import { resetSyncModifyCodeServiceGlobals } from './service/sync-modify-code.ts'

// 导入所有服务注册函数
import {
  registerGetConfiguration,
  registerCheckConfiguration,
  registerGetWatchStatus,
  registerBuildModules,
  registerSyncModifyCode,
  registerSyncDesignStaticAssets,
  registerSyncSingleModule
} from './service/index.ts'

/**
 * 全局监控器存储
 */
const watchers: Map<string, FSWatcher> = new Map()

/**
 * 重置所有全局变量
 * 用于清理进程退出或MCP被禁用时的所有全局状态
 */
function resetAllGlobals(): void {
  console.error('【重置全局变量】开始清理所有全局状态...')

  // 重置 domain 层全局变量
  resetBuildModulesGlobals()
  resetSyncSingleModuleGlobals()
  resetWatchModulesGlobals()

  // 重置 service 层全局变量
  resetSyncSingleModuleServiceGlobals()
  resetSyncDesignStaticAssetsServiceGlobals()
  resetBuildModulesServiceGlobals()
  resetSyncModifyCodeServiceGlobals()

  console.error('【重置全局变量】所有全局状态已清理完成')
}

/**
 * 定义了 MCP Server 实例。
 */
const server = new McpServer({
  name: 'frontend-develop-tools',
  version: '1.0.0'
})

// 自动启动模块监控
startWatchingModules(watchers)

process.on('SIGTERM', () => {
  console.error('【SIGTERM】MCP被禁用了')
  stopWatchingModules(watchers)
  resetAllGlobals()
  process.exit(0)
})

process.on('exit', () => {
  console.error('【exit】MCP进程退出')
  resetAllGlobals()
})

// 注册所有工具
registerGetConfiguration(server)
registerCheckConfiguration(server)
registerGetWatchStatus(server, watchers)
registerBuildModules(server)
registerSyncModifyCode(server)
registerSyncDesignStaticAssets(server)
registerSyncSingleModule(server)

/**
 * 启动服务器并建立与传输层的连接。
 * 该函数创建一个标准输入输出的服务器传输实例，
 * 并使用该实例将服务器连接到传输层。
 */
const transport = new StdioServerTransport()

// 等待服务器通过指定的传输实例建立连接
await server.connect(transport)
