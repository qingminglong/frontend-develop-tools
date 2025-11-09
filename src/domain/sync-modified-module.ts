import {
  buildModules,
  getCachedBuildModules,
  getAllBuildedModules
} from './build-modules.ts'
import { syncCompiledFiles } from '../utils/sync.ts'
import { logToChat } from '../utils/index.ts'
import { detectChangedModulesForAllPaths } from './detect-changed-module.ts'
import { SYNC_MODIFIED_MODULE_MESSAGES } from '../consts/sync-modified-module.ts'

/**
 * 同步 UMD 文件到项目中的匹配位置
 * @param modulePath - 模块路径
 * @param moduleName - 模块名称
 * @param projectPaths - 项目路径列表
 * @returns 拷贝的目录数量
 */

/**
 * 同步修改代码
 * 在代码修改后同步执行构建任务并同步编译后的文件
 * @returns 同步修改是否成功执行
 */
export function syncModifiedModule(): boolean {
  try {
    logToChat(SYNC_MODIFIED_MODULE_MESSAGES.SYNC_MODIFY_START)

    // 检测变更的模块
    detectChangedModulesForAllPaths()

    // 获取所有已构建的模块
    getAllBuildedModules()

    // 调用 buildModules 执行构建
    const isSuccess = buildModules()

    if (!isSuccess) {
      logToChat(SYNC_MODIFIED_MODULE_MESSAGES.BUILD_FAILED)
      return false
    }

    // 同步编译后的文件
    const buildedModules = getCachedBuildModules()
    const syncResult = syncCompiledFiles(
      buildedModules,
      SYNC_MODIFIED_MODULE_MESSAGES
    )

    if (!syncResult) {
      logToChat(SYNC_MODIFIED_MODULE_MESSAGES.FILE_SYNC_FAILED)
      return false
    }

    logToChat(SYNC_MODIFIED_MODULE_MESSAGES.SYNC_MODIFY_SUCCESS)
    return true
  } catch (error) {
    logToChat(
      SYNC_MODIFIED_MODULE_MESSAGES.SYNC_MODIFY_ERROR,
      error instanceof Error ? error.message : String(error)
    )
    return false
  }
}
