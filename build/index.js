// MCP - NODE SDK
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// 导入 StdioServerTransport 类，用于处理服务器的输入输出通信
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as fs from 'fs';
import { configuration } from './get-configuration.js';
import { startWatchingModules } from './start-watch.js';
import { stopWatchingModules } from './stop-watch.js';
/**
 * 全局监控器存储
 */
const watchers = new Map();
/**
 * 定义了 MCP Server 实例。
 */
const server = new McpServer({
    name: 'frontend-develop-tools',
    version: '1.0.0'
});
startWatchingModules(watchers);
process.on('SIGINT', () => {
    stopWatchingModules(watchers);
    process.exit(0);
});
// 注册工具：获取项目配置信息
server.registerTool('get-configuration', {
    title: 'get-configuration',
    description: '获取模块路径和项目路径的配置信息',
    inputSchema: {}
}, async () => {
    try {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(configuration, null, 2)
                }
            ]
        };
    }
    catch (e) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`
                }
            ],
            isError: true
        };
    }
});
// 注册工具：检查路径是否存在
server.registerTool('check-configuration', {
    title: 'check-configuration',
    description: '检查配置的模块路径和项目路径是否存在',
    inputSchema: {}
}, async () => {
    try {
        const modulePathsStatus = configuration.modulePaths.map((p) => ({
            path: p,
            exists: fs.existsSync(p),
            isDirectory: fs.existsSync(p) ? fs.statSync(p).isDirectory() : false
        }));
        const projectPathsStatus = configuration.projectPaths.map((p) => ({
            path: p,
            exists: fs.existsSync(p),
            isDirectory: fs.existsSync(p) ? fs.statSync(p).isDirectory() : false
        }));
        const result = {
            modulePaths: modulePathsStatus,
            projectPaths: projectPathsStatus
        };
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    }
    catch (e) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`
                }
            ],
            isError: true
        };
    }
});
// 注册工具：启动模块监控
server.registerTool('start-watch-modules', {
    title: 'start-watch-modules',
    description: '遍历配置的模块路径并启动文件变化监控',
    inputSchema: {}
}, async () => {
    try {
        const results = startWatchingModules(watchers);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        message: '模块监控启动完成',
                        totalPaths: configuration.modulePaths.length,
                        activeWatchers: watchers.size,
                        results: results
                    }, null, 2)
                }
            ]
        };
    }
    catch (e) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`
                }
            ],
            isError: true
        };
    }
});
// 注册工具：停止模块监控
server.registerTool('stop-watch-modules', {
    title: 'stop-watch-modules',
    description: '停止所有正在运行的模块监控',
    inputSchema: {}
}, async () => {
    try {
        const stoppedPaths = await stopWatchingModules(watchers);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        message: '所有模块监控已停止',
                        stoppedCount: stoppedPaths.length,
                        stoppedPaths: stoppedPaths
                    }, null, 2)
                }
            ]
        };
    }
    catch (e) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`
                }
            ],
            isError: true
        };
    }
});
// 注册工具：获取监控状态
server.registerTool('get-watch-status', {
    title: 'get-watch-status',
    description: '获取当前模块监控的状态信息',
    inputSchema: {}
}, async () => {
    try {
        const watchingPaths = Array.from(watchers.keys());
        const notWatchingPaths = configuration.modulePaths.filter((p) => !watchers.has(p));
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        totalConfiguredPaths: configuration.modulePaths.length,
                        activeWatchers: watchers.size,
                        watchingPaths: watchingPaths,
                        notWatchingPaths: notWatchingPaths
                    }, null, 2)
                }
            ]
        };
    }
    catch (e) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`
                }
            ],
            isError: true
        };
    }
});
/**
 * 启动服务器并建立与传输层的连接。
 * 该函数创建一个标准输入输出的服务器传输实例，
 * 并使用该实例将服务器连接到传输层。
 */
const transport = new StdioServerTransport();
// 等待服务器通过指定的传输实例建立连接
await server.connect(transport);
