import { defineConfig, searchForWorkspaceRoot } from 'vite'
import dts from 'vite-plugin-dts'
import * as path from 'path'
import pkg from './package.json'

// 将所有依赖和 Node.js 内置模块标记为外部依赖
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
  // Node.js 内置模块
  'fs',
  'path',
  'child_process',
  'fs/promises',
  'events',
  'os',
  'url',
  'stream',
  'string_decoder',
  /^node:/ // 所有 node: 协议的导入
]

export default defineConfig({
  plugins: [
    dts({
      // 配置 dts 插件以正确处理 .ts 扩展名
      insertTypesEntry: true,
      rollupTypes: true
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'build',
    target: 'node18', // 设置为 Node.js 环境
    ssr: true, // 启用 SSR 模式（适用于 Node.js）
    lib: {
      entry: path.resolve(__dirname, './src/index.ts'),
      formats: ['es'], // 只生成 ES 模块格式
      fileName: () => 'index.js'
    },
    rollupOptions: {
      external,
      output: {
        preserveModules: true, // 保持模块结构
        preserveModulesRoot: 'src', // 设置模块根目录
        entryFileNames: '[name].js',
        format: 'es'
      }
    }
  },
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())]
    }
  }
})
