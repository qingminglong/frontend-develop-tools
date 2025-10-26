// MCP - NODE SDK
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// 导入 StdioServerTransport 类，用于处理服务器的输入输出通信
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import axios from 'axios';
import * as fs from 'fs';
import { watchModulesWithPath } from './watch-modules.js';
/**
 * 解析环境变量为字符串数组，支持多种格式
 * @param envValue 环境变量值
 * @returns 解析后的字符串数组
 */
function parseEnvArray(envValue) {
    // 如果已经是数组，直接返回
    if (Array.isArray(envValue)) {
        return envValue.filter((item) => typeof item === 'string' && item.trim() !== '');
    }
    // 如果不是字符串，返回空数组
    if (typeof envValue !== 'string') {
        return [];
    }
    const trimmedValue = envValue.trim();
    if (!trimmedValue) {
        return [];
    }
    // 尝试作为 JSON 数组解析
    if (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmedValue);
            if (Array.isArray(parsed)) {
                return parsed.filter((item) => typeof item === 'string' && item.trim() !== '');
            }
        }
        catch (error) {
            console.error(`JSON 数组解析失败: ${error}`);
        }
    }
    // 尝试作为逗号分隔的字符串解析
    if (trimmedValue.includes(',')) {
        return trimmedValue
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item !== '');
    }
    // 单个路径
    return [trimmedValue];
}
/**
 * 从命令行参数或配置文件读取配置
 */
function getConfiguration() {
    const projectPatchsEnv = process.env.PROJECT_PATCHS;
    const modulePathsEnv = process.env.MODULE_PATHS;
    const config = {
        modulePaths: [],
        projectPaths: []
    };
    if (projectPatchsEnv || modulePathsEnv) {
        try {
            // 解析 MODULE_PATHS 环境变量
            if (modulePathsEnv) {
                try {
                    config.modulePaths = parseEnvArray(modulePathsEnv);
                    if (config.modulePaths.length === 0) {
                        console.warn('MODULE_PATHS 解析结果为空');
                    }
                }
                catch (error) {
                    console.error(`MODULE_PATHS 解析失败: ${error}`);
                    config.modulePaths = [];
                }
            }
            // 解析 PROJECT_PATCHS 环境变量
            if (projectPatchsEnv) {
                try {
                    config.projectPaths = parseEnvArray(projectPatchsEnv);
                    if (config.projectPaths.length === 0) {
                        console.warn('PROJECT_PATCHS 解析结果为空');
                    }
                }
                catch (error) {
                    console.error(`PROJECT_PATCHS 解析失败: ${error}`);
                    config.projectPaths = [];
                }
            }
            // 如果至少有一个配置有效，则返回配置数组
            if (config.modulePaths.length > 0 || config.projectPaths.length > 0) {
                return config;
            }
        }
        catch (error) {
            console.error(`环境变量配置处理失败: ${error}`);
        }
    }
    // 尝试从旧格式的 PROJECT_CONFIG 环境变量读取（向后兼容）
    const configEnv = process.env.PROJECT_CONFIG;
    if (configEnv) {
        try {
            return JSON.parse(configEnv);
        }
        catch (error) {
            console.error(`PROJECT_CONFIG 环境变量解析失败: ${error}`);
        }
    }
    // 返回默认配置
    console.warn('未找到有效的项目配置，返回空配置');
    return config;
}
/**
 * 全局配置存储
 */
const configuration = getConfiguration();
console.log('加载的项目配置:', JSON.stringify(configuration, null, 2));
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
        if (configuration.modulePaths.length === 0) {
            return {
                content: [
                    {
                        type: 'text',
                        text: '没有配置需要监控的模块路径'
                    }
                ],
                isError: true
            };
        }
        const results = [];
        // 遍历所有模块路径并启动监控
        for (const modulePath of configuration.modulePaths) {
            try {
                // 如果已经在监控，跳过
                if (watchers.has(modulePath)) {
                    results.push({
                        path: modulePath,
                        status: 'already_watching'
                    });
                    continue;
                }
                // 启动监控
                const watcher = watchModulesWithPath(modulePath);
                watchers.set(modulePath, watcher);
                results.push({
                    path: modulePath,
                    status: 'started'
                });
            }
            catch (error) {
                results.push({
                    path: modulePath,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
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
        const stoppedPaths = [];
        // 停止所有监控器
        for (const [modulePath, watcher] of watchers.entries()) {
            await watcher.close();
            stoppedPaths.push(modulePath);
        }
        // 清空监控器映射
        watchers.clear();
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
server.registerTool('ui-config', {
    title: 'ui-config',
    description: '获取阿波罗配置或ui配置',
    inputSchema: {}
}, async () => {
    try {
        // 发送请求并获取响应
        const requestUrl = `https://lcap.test.zte.com.cn/zte-paas-lcap-demobff/uiconfig`;
        // 发送请求并获取响应
        const response = (await axios.get(requestUrl));
        console.log('requestUrl', requestUrl);
        // 返回响应结果
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(response.data)
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
