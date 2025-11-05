import { getWorkspacePackages } from './build/domain/detect-changed-module.js'

const packages = getWorkspacePackages('/home/git/frontend')
console.log('找到的包数量:', packages.length)
packages.forEach(pkg => {
  console.log('包名:', pkg.name)
})

// 检查是否包含 card-renderer
const hasCardRenderer = packages.some(pkg => pkg.name === 'boot/card-renderer')
console.log('是否包含 boot/card-renderer:', hasCardRenderer)
