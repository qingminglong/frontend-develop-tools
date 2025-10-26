import { defineConfig, searchForWorkspaceRoot } from 'vite'
import dts from 'vite-plugin-dts'
import * as path from 'path'
import pkg from './package.json'

const external = Object.keys(pkg.devDependencies)
export default defineConfig({
  plugins: [dts()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'build',
    target: 'es2022',
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, './src/index.ts')
      },
      output: {
        entryFileNames: () => {
          return '[name].js'
        },
        chunkFileNames: '[name]-[hash].js'
      },
      external
    }
  },
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())]
    }
  }
})
