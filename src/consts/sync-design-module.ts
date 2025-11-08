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

/**
 * 同步设计态静态资源域层消息常量
 */
export const SYNC_DESIGN_MODULE_DOMAIN_MESSAGES = {
  // 依赖检查相关
  MISSING_DEPENDENCIES: '项目 {path} 缺少依赖，正在安装...',
  DEPENDENCIES_INSTALLED: '依赖安装完成',
  DEPENDENCIES_EXIST: '项目依赖已存在，跳过安装',
  INSTALL_FAILED: '安装依赖失败:',

  // pnpm模块查找相关
  PNPM_DIR_NOT_FOUND: '未找到 .pnpm 目录: {path}',
  SEARCHING_MODULE: '正在查找模块 {moduleName} (前缀: {prefix})',
  PNPM_DIR_NOT_MATCHED: '未找到匹配的 pnpm 目录 (前缀: {prefix})',
  PNPM_DIR_FOUND: '找到 pnpm 目录: {dir}',
  TARGET_DIR_NOT_EXIST: '目标目录不存在: {path}',
  TARGET_PATH_FOUND: '找到目标路径: {path}',
  FIND_MODULE_FAILED: '查找模块失败:',

  // 目录拷贝相关
  SOURCE_DIR_NOT_EXIST: '源目录不存在: {path}',
  COPYING_DIR: '正在拷贝目录: {dirName}',
  COPY_SUCCESS: '目录拷贝成功: {dirName}',
  COPY_FAILED: '目录拷贝失败: {dirName}',

  // UMD同步相关
  UMD_DIR_NOT_FOUND: '模块 {moduleName} 未找到 UMD 目录',
  UMD_DIR_FOUND: '找到 UMD 目录: {path}',
  UMD_FILES_FOUND: 'UMD 目录下找到 {count} 个文件',
  UMD_FILE_ITEM: '   - {fileName}',
  UMD_DIR_COPIED: 'UMD 文件已拷贝到 {destPath} ({count} 个文件)',
  UMD_FILE_COPY_FAILED: 'UMD 文件拷贝失败: {fileName}',
  UMD_SYNC_START: '开始同步 UMD 文件...',
  UMD_FILTERED_PROJECTS: '过滤后共有 {count} 个项目需要同步 UMD',
  UMD_SYNC_SUMMARY: 'UMD 同步完成，共拷贝到 {count} 个项目',

  // 文件检查相关
  POSTINSTALL_NOT_FOUND: '未找到 postinstall.js 文件: {path}，跳过 UMD 同步',
  POSTINSTALL_EMPTY: 'postinstall.js 文件为空，跳过 UMD 同步',
  POSTINSTALL_UMD_RENDER_KEYWORD:
    '检测到 public/umd/render 关键字，将拷贝到该路径',
  POSTINSTALL_UMD_KEYWORD: '检测到 public/umd 关键字，将拷贝到该路径',
  POSTINSTALL_NO_UMD_KEYWORD:
    'postinstall.js 中未找到 public/umd/render 或 public/umd 关键字，跳过 UMD 同步',

  // 通用消息
  PREPARING_UMD_COPY: '准备拷贝 UMD 文件到: {path}',
  CREATING_TARGET_DIR: '创建目标目录: {path}',
  UMD_DIR_EMPTY: 'UMD 目录下没有文件',
  UMD_COPY_TO_PROJECT_FAILED: '拷贝 UMD 文件到项目失败: {path}',

  // 项目处理相关
  PROCESSING_MODULE: '正在处理模块: {moduleName}',
  SKIP_PROJECT: '跳过项目: {path}',
  SYNC_TO_PROJECT: '同步到项目 {path} 成功 ({count} 个目录)',
  NO_DIRS_TO_COPY: '项目 {path} 无需拷贝目录',

  // 同步流程相关
  SYNC_START: '\n📦 开始同步编译后的文件...',
  SYNC_FILES_START: '开始同步编译后的文件...',
  NO_PROJECT_PATHS: '⚠️ 未配置项目路径',
  PROJECT_LIST: '📂 项目列表 ({count}):',
  PROJECT_ITEM: '   - {path}',
  CHECK_DEPENDENCIES: '检查项目依赖...',
  DEPENDENCY_CHECK_FAILED: '项目 {path} 依赖检查失败',
  MODULES_TO_SYNC: '需要同步的模块 ({count}):',
  MODULE_ITEM: '   - {moduleName}',
  NO_MODULES_TO_SYNC: '没有需要同步的模块',

  // 统计信息
  SYNC_STATISTICS: '\n\n📊 同步统计:',
  STAT_SUCCESS: '   ✅ 成功同步: {count}',
  STAT_MODULES: '   📦 处理模块数: {count}',
  STAT_PROJECTS: '   📂 处理项目数: {count}',

  // 同步结果
  SYNC_FILES_FAILED: '文件同步失败:'
} as const
