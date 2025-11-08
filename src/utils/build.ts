import { execSync } from 'child_process'
import type { BuildedModule } from '../types/build-modules.ts'
import { BUILD_REASON, SPECIAL_CHARS, LOG_MESSAGES } from '../consts/index.ts'
import { logToChat } from './index.ts'

/**
 * 通用的模块编译函数
 * @param modules - 需要编译的模块列表
 * @param buildCommand - 编译命令，如 'build' 或 'build:umd'
 * @returns 编译是否成功执行
 */
export function executeBuildModules(
  modules: BuildedModule[],
  buildCommand: string
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
