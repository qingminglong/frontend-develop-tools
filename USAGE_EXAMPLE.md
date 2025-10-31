# build-modules 使用示例

## 功能概述

`build-modules.ts` 提供了完整的模块依赖分析和自动编译功能，包括：

1. **依赖分析**：分析变更模块和所有依赖它们的父模块
2. **全局缓存**：缓存需要编译的模块列表
3. **状态监听**：监听编译状态变化并自动触发编译
4. **拓扑排序**：确保编译顺序正确

## 核心 API

### 1. 全局变量

- `cachedBuildModules`：缓存所有需要编译的模块列表
- `isAllBuilded`：标识所有模块是否已经编译完成
- `onBuildedCallbacks`：回调函数列表

### 2. 主要函数

#### `getAllBuildModules()`

获取需要编译的模块列表（调用前会自动清空缓存并重置状态）

```typescript
import { getAllBuildModules } from './build-modules'

const modules = getAllBuildModules()
console.log(`需要编译 ${modules.length} 个模块`)
```

#### `getCachedBuildModules()`

获取缓存的编译模块列表

```typescript
import { getCachedBuildModules } from './build-modules'

const cachedModules = getCachedBuildModules()
```

#### `getIsAllBuilded()` / `setIsAllBuilded(value)`

获取/设置编译完成状态

```typescript
import { getIsAllBuilded, setIsAllBuilded } from './build-modules'

console.log(getIsAllBuilded()) // false

// 模拟编译完成
setIsAllBuilded(true) // 会触发所有注册的回调
```

#### `onAllBuilded(callback)`

注册编译完成回调（返回取消注册的函数）

```typescript
import { onAllBuilded } from './build-modules'

const unsubscribe = onAllBuilded(() => {
  console.log('编译完成！')
})

// 取消监听
unsubscribe()
```

#### `buildModules()`

执行模块编译（只有当 `isAllBuilded` 为 true 时才会执行）

```typescript
import { buildModules } from './build-modules'

const success = buildModules()
if (!success) {
  console.log('编译未执行，因为 isAllBuilded 为 false')
}
```

#### `initBuildListener()`

初始化编译监听器（自动注册回调）

```typescript
import { initBuildListener } from './build-modules'

initBuildListener()
// 现在当 isAllBuilded 变为 true 时，会自动执行 buildModules()
```

## 完整使用示例

### 示例 1：基本使用流程

```typescript
import {
  getAllBuildModules,
  setIsAllBuilded,
  initBuildListener
} from './build-modules'

// 1. 初始化监听器
initBuildListener()

// 2. 获取需要编译的模块（自动清空缓存并重置状态）
const modules = getAllBuildModules()
console.log(`检测到 ${modules.length} 个需要编译的模块`)

// 3. 这里可以做一些准备工作
console.log('准备编译环境...')

// 4. 设置编译完成标志（会自动触发 buildModules）
setIsAllBuilded(true)
```

### 示例 2：手动控制编译流程

```typescript
import {
  getAllBuildModules,
  getCachedBuildModules,
  buildModules,
  setIsAllBuilded
} from './build-modules'

// 1. 获取需要编译的模块
const modules = getAllBuildModules()

// 2. 查看缓存的模块
const cached = getCachedBuildModules()
console.log('缓存的模块:', cached)

// 3. 手动设置状态并编译
setIsAllBuilded(true)
const success = buildModules()

if (success) {
  console.log('编译成功')
}
```

### 示例 3：多次监听

```typescript
import { onAllBuilded, setIsAllBuilded } from './build-modules'

// 注册多个回调
const unsubscribe1 = onAllBuilded(() => {
  console.log('回调1：发送通知')
})

const unsubscribe2 = onAllBuilded(() => {
  console.log('回调2：更新日志')
})

// 触发所有回调
setIsAllBuilded(true)

// 取消某个监听
unsubscribe1()
```

### 示例 4：与文件监听集成

```typescript
import { detectAndCacheChangedModules } from './detect-changed-modules'
import {
  getAllBuildModules,
  setIsAllBuilded,
  initBuildListener
} from './build-modules'

// 初始化编译监听
initBuildListener()

// 监听文件变化
const projectPath = '/home/git/frontend'

// 检测变更
detectAndCacheChangedModules(projectPath)

// 获取需要编译的模块
const modules = getAllBuildModules()

if (modules.length > 0) {
  console.log(`检测到 ${modules.length} 个模块需要编译`)

  // 模拟编译过程
  setTimeout(() => {
    console.log('所有模块编译完成')
    setIsAllBuilded(true) // 触发编译回调
  }, 3000)
} else {
  console.log('没有需要编译的模块')
}
```

## 工作流程

```
1. detectAndCacheChangedModules()
   ↓ 检测 git 变更

2. getAllBuildModules()
   ↓ 分析依赖关系
   ↓ 清空缓存并重置状态
   ↓ 更新缓存

3. 缓存模块列表到 cachedBuildModules
   isAllBuilded = false

4. 执行实际编译...

5. setIsAllBuilded(true)
   ↓ 触发回调

6. buildModules() 自动执行
   ↓ 遍历 cachedBuildModules
   ↓ 执行编译
```

## 模块信息结构

```typescript
interface BuildedModuleInfo {
  moduleName: string // 模块名称
  modulePath: string // 模块路径
  reason: 'changed' | 'dependent' // 编译原因
  dependedBy?: string[] // 被哪些模块依赖
}
```

## 注意事项

1. **调用顺序**：`getAllBuildModules()` 会自动清空缓存，所以每次检测变更后都需要重新调用
2. **状态监听**：`setIsAllBuilded(true)` 只会在状态从 false 变为 true 时触发回调
3. **编译保护**：`buildModules()` 只有在 `isAllBuilded === true` 时才会执行
4. **回调管理**：使用 `onAllBuilded()` 返回的函数来取消监听，避免内存泄漏

## 扩展功能

你可以在 `buildModules()` 函数中添加实际的编译逻辑：

```typescript
// 在 build-modules.ts 中修改
export function buildModules(): boolean {
  if (!isAllBuilded) {
    return false
  }

  const modules = getCachedBuildModules()

  modules.forEach((module) => {
    // 添加实际编译逻辑
    execSync(`cd ${module.modulePath} && pnpm build`, {
      stdio: 'inherit'
    })
  })

  return true
}
```
