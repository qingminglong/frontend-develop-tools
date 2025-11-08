import { execSync } from 'child_process'
import path from 'path'
import type { BuildedModule } from '../types/build-modules.ts'
import { BUILD_REASON, SPECIAL_CHARS, LOG_MESSAGES } from '../consts/index.ts'
import { logToChat, parseWorkspacePatterns } from './index.ts'
import { configuration } from '../domain/get-configuration.ts'

/**
 * 通用的模块编译函数
 * @param modules - 需要编译的模块列表
 * @param isDesign - 是否为设计态编译，如果为true则执行build:umd，否则执行build
 * @returns 编译是否成功执行
 */
export function executeBuildModules(
  modules: BuildedModule[],
  isDesign: boolean
): boolean {
  if (modules.length === 0) {
    logToChat(LOG_MESSAGES.NO_MODULES_TO_BUILD)
    return true
  }

  logToChat(LOG_MESSAGES.BUILD_START.replace('{count}', String(modules.length)))

  let successCount = 0
  let failCount = 0

  modules.forEach((module, index) => {
    const reasonText =
      module.reason === BUILD_REASON.CHANGED
        ? '直接变更'
        : `被依赖 (${module.dependedBy?.join(SPECIAL_CHARS.COMMA + ' ') ?? ''})`

    logToChat(`[${index + 1}/${modules.length}] 编译模块: ${module.moduleName}`)
    logToChat(`   路径: ${module.modulePath}`)
    logToChat(`   原因: ${reasonText}`)

    try {
      // 根据isDesign确定编译命令
      const buildCommand = isDesign ? 'build:umd' : 'build'

      // 执行编译命令
      logToChat(`   🔨 执行编译命令: pnpm run ${buildCommand}`)

      const startTime = Date.now()

      execSync(`pnpm run ${buildCommand}`, {
        cwd: module.modulePath,
        stdio: 'inherit', // 将编译输出直接显示在控制台
        encoding: 'utf8',
        timeout: 600000 // 10分钟超时
      })

      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      logToChat(`   ✅ 编译成功 (耗时: ${duration}s)${SPECIAL_CHARS.NEWLINE}`)
      successCount++
    } catch (error) {
      logToChat(
        `   ❌ 编译失败:`,
        error instanceof Error ? error.message : error
      )
      logToChat(SPECIAL_CHARS.NEWLINE)
      failCount++
    }
  })

  logToChat(`\n📊 编译统计:`)
  logToChat(`   ✅ 成功: ${successCount}`)
  logToChat(`   ❌ 失败: ${failCount}`)
  logToChat(`   📦 总计: ${modules.length}\n`)

  // 根据编译结果返回状态
  if (failCount > 0) {
    logToChat(`❌ 编译完成，但有 ${failCount} 个模块编译失败`)
    return false
  }

  logToChat(LOG_MESSAGES.BUILD_COMPLETE)
  return true
}

/**
 * 获取 pnpm-workspace.yaml 中被排除的包模式列表
 * @returns 被排除的包模式数组
 */
export function getExcludedModules(): string[] {
  try {
    const excludeModulesSet = new Set<string>()

    // 遍历所有模块路径，收集排除模式
    for (const modulePath of configuration.modulePaths) {
      const { excludeModules } = parseWorkspacePatterns(modulePath)
      excludeModules.forEach((pattern) => excludeModulesSet.add(pattern))
    }

    return Array.from(excludeModulesSet)
  } catch (error) {
    logToChat(
      `读取 pnpm-workspace.yaml 失败: ${
        error instanceof Error ? error.message : error
      }`
    )
    return []
  }
}

/**
 * 检查模块是否被排除
 * @param modulePath - 模块绝对路径
 * @param excludeModules - 排除模式列表（相对路径）
 * @returns 是否被排除
 */
export function isModuleExcluded(
  modulePath: string,
  excludeModules: string[]
): boolean {
  // 如果没有排除模式，直接返回 false
  if (excludeModules.length === 0) {
    return false
  }

  // 将绝对路径转换为相对于 workspace 的相对路径
  // 找到 workspace 根目录（通常是 modulePaths 中的父目录）
  let relativePath = modulePath

  // 尝试从配置的模块路径中找到匹配的 workspace 根目录
  for (const workspacePath of configuration.modulePaths) {
    if (modulePath.startsWith(workspacePath)) {
      // 计算相对于 workspace 的路径
      relativePath = path.relative(workspacePath, modulePath)
      // 统一路径分隔符为正斜杠（兼容不同操作系统）
      relativePath = relativePath.replace(/\\/g, '/')
      break
    }
  }

  // 检查是否匹配任何排除模式
  return excludeModules.some((excludePattern) => {
    // 支持精确匹配和路径前缀匹配
    return (
      relativePath === excludePattern ||
      relativePath.startsWith(excludePattern + '/')
    )
  })
}
