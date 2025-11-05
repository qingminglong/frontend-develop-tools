/**
 * 同步设计态静态资源相关消息常量
 */
export const SYNC_DESIGN_MODULE_MESSAGES = {
  // 主流程相关
  SYNC_START: '🔄 开始同步设计态静态资源...',
  SYNC_SUCCESS: '✅ 设计态静态资源同步成功',
  SYNC_FAILED: '❌ 设计态静态资源同步失败:',
  SYNC_ERROR: '❌ 同步设计态静态资源执行异常:',

  // 项目路径相关
  NO_PROJECT_PATHS: '⚠️  未配置项目路径，无法同步静态资源',
  PROJECT_LIST: '📂 项目列表 ({count}):',
  PROJECT_ITEM: '   - {path}',

  // 模块路径相关
  NO_MODULE_PATHS: '⚠️  未配置模块路径，无法同步静态资源',
  MODULE_PATH_INFO: '📦 模块路径: {path}',

  // 静态资源目录相关
  CHECKING_ASSETS: '\n🔍 检查静态资源目录...',
  ASSETS_DIR_NOT_FOUND: '   ℹ️  模块中未找到静态资源目录: {dir}',
  ASSETS_DIR_FOUND: '   ✓ 找到静态资源目录: {path}',
  ASSETS_FILES_FOUND: '   📦 找到 {count} 个静态资源文件/目录',

  // 目标路径查找相关
  SEARCHING_TARGET: '   🔍 在项目 {projectPath} 中查找目标目录...',
  TARGET_DIR_FOUND: '   ✓ 找到目标目录: {path}',
  TARGET_DIR_NOT_FOUND: '   ⚠️  未找到目标目录，跳过该项目',

  // 拷贝相关
  COPYING_ASSETS: '\n📋 开始拷贝静态资源...',
  COPYING_FILE: '      拷贝: {fileName}',
  COPY_SUCCESS: '      ✅ 拷贝成功: {fileName}',
  COPY_FAILED: '      ❌ 拷贝失败: {fileName}',
  CREATING_TARGET_DIR: '      创建目标目录: {path}',

  // 统计信息
  SYNC_STATISTICS: '\n\n📊 同步统计:',
  STAT_SUCCESS: '   ✅ 成功: {count} 个文件',
  STAT_FAILED: '   ❌ 失败: {count} 个文件',
  STAT_PROJECTS: '   📂 同步到: {count} 个项目',
  STAT_TOTAL_FILES: '   📦 总文件数: {count}'
} as const

/**
 * 同步设计态静态资源服务层消息常量
 */
export const SYNC_DESIGN_MODULE_SERVICE_MESSAGES = {
  // 互斥控制相关
  OPERATION_IN_PROGRESS_WARNING:
    '⚠️  有静态资源同步操作正在执行，请等待上次操作完成再尝试',
  OPERATION_IN_PROGRESS: '有静态资源同步操作正在执行，请等待上次操作完成再尝试',

  // 任务执行相关
  TASK_START: '🔄 开始执行同步设计态静态资源任务...',
  TASK_SUCCESS_LOG: '✅ 同步设计态静态资源任务执行成功',
  TASK_FAILED_LOG: '❌ 同步设计态静态资源任务执行失败',
  TASK_SUCCESS: '同步设计态静态资源任务执行成功',
  TASK_FAILED: '同步设计态静态资源任务执行失败',
  TASK_ERROR: '❌ 同步设计态静态资源任务执行出错:',
  TASK_END: '🏁 同步设计态静态资源任务结束，释放互斥锁',

  // 错误消息前缀
  ERROR_PREFIX: 'Error: '
} as const
