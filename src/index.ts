// MCP - NODE SDK
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// 导入 StdioServerTransport 类，用于处理服务器的输入输出通信
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

// 导入用于验证输入参数的库
import { z } from 'zod'
import axios from 'axios'

/**
 * 定义了 MCP Server 实例。
 */
const server = new McpServer({
  name: 'ui-config',
  version: '1.0.0'
})

server.registerTool(
  'ui-config',
  {
    title: 'ui-config',
    description: '获取阿波罗配置或ui配置',
    inputSchema: {}
  },
  async () => {
    try {
      // 发送请求并获取响应
      const requestUrl = `https://lcap.test.zte.com.cn/zte-paas-lcap-demobff/uiconfig`

      // 发送请求并获取响应
      const response = (await axios.get(requestUrl)) as any
      console.log('requestUrl', requestUrl)
      // 返回响应结果
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data)
          }
        ]
      }
    } catch (e) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`
          }
        ],
        isError: true
      }
    }
  }
)

/**
 * 启动服务器并建立与传输层的连接。
 * 该函数创建一个标准输入输出的服务器传输实例，
 * 并使用该实例将服务器连接到传输层。
 */
const transport = new StdioServerTransport()

// 等待服务器通过指定的传输实例建立连接
await server.connect(transport)
