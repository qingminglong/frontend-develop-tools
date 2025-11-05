/**
 * 同步修改代码日志消息常量
 */
export const SYNC_MODIFY_MESSAGES = {
  // 依赖检查相关
  MISSING_DEPENDENCIES: '   📦 项目 {path} 缺少依赖，开始安装...',
  DEPENDENCIES_INSTALLED: '   ✅ 依赖安装完成',
  DEPENDENCIES_EXIST: '   ✓ 项目依赖已存在',
  INSTALL_FAILED: '   ❌ 安装依赖失败:',

  // 模块查找相关
  PNPM_DIR_NOT_FOUND: '   ⚠️  未找到 .pnpm 目录: {path}',
  SEARCHING_MODULE: '   🔍 查找模块: {moduleName} (搜索前缀: {prefix})',
  PNPM_DIR_NOT_MATCHED: '   ⚠️  未找到匹配的 pnpm 目录，前缀: {prefix}',
  PNPM_DIR_FOUND: '   ✓ 找到 pnpm 目录: {dir}',
  TARGET_DIR_NOT_EXIST: '   ⚠️  目录不存在: {path}',
  TARGET_PATH_FOUND: '   ✓ 目标路径: {path}',
  FIND_MODULE_FAILED: '   ❌ 查找模块路径失败:',

  // 拷贝相关
  SOURCE_DIR_NOT_EXIST: '     ⚠️  源目录不存在: {path}',
  COPYING_DIR: '     📁 拷贝 {dirName}...',
  COPY_SUCCESS: '     ✅ {dirName} 拷贝成功',
  COPY_FAILED: '     ❌ {dirName} 拷贝失败:',

  // 同步流程相关
  SYNC_START: '\n📦 开始同步编译后的文件...',
  NO_PROJECT_PATHS: '⚠️  未配置项目路径',
  PROJECT_LIST: '📂 项目列表 ({count}):',
  PROJECT_ITEM: '   - {path}',
  CHECK_DEPENDENCIES: '\n🔍 检查项目依赖...',
  DEPENDENCY_CHECK_FAILED: '❌ 项目 {path} 依赖检查失败，跳过',
  NO_MODULES_TO_SYNC: '\n⚠️  没有需要同步的模块',
  MODULES_TO_SYNC: '\n📋 需要同步的模块 ({count}):',
  MODULE_ITEM: '   - {moduleName}',
  SYNC_FILES_START: '\n🔄 开始同步文件...\n',
  PROCESSING_MODULE: '\n处理模块: {moduleName}',
  SKIP_PROJECT: '   ⚠️  跳过项目: {path}',
  SYNC_TO_PROJECT: '   ✅ 同步到项目: {path} ({count} 个目录)',
  NO_DIRS_TO_COPY: '   ⚠️  没有可拷贝的目录: {path}',
  SYNC_STATISTICS: '\n\n📊 同步统计:',
  STAT_SUCCESS: '   ✅ 成功: {count}',
  STAT_SKIPPED: '   ⚠️  跳过: {count}',
  STAT_MODULES: '   📦 模块: {count}',
  STAT_PROJECTS: '   📂 项目: {count}\n',
  SYNC_FILES_FAILED: '❌ 同步编译文件失败:',

  // UMD 文件同步相关
  UMD_SYNC_START: '\n🔍 检查 UMD 文件...',
  UMD_DIR_NOT_FOUND: '   ℹ️  模块 {moduleName} 没有 UMD 目录，跳过',
  UMD_DIR_FOUND: '   ✓ 找到 UMD 目录: {path}',
  UMD_FILES_FOUND: '   📦 找到 {count} 个 UMD 文件',
  UMD_FILE_ITEM: '      - {fileName}',
  UMD_SEARCHING_FILE: '   🔍 搜索文件: {fileName} 在项目 {projectPath}',
  UMD_FILE_MATCHED: '      ✓ 匹配到: {filePath}',
  UMD_NO_MATCH: '      ℹ️  未找到匹配的文件',
  UMD_COPYING_ALL_FILES:
    '   📋 准备拷贝 {count} 个文件到 {targetCount} 个目标目录',
  UMD_DIR_COPIED: '      ✅ 已拷贝 {count} 个文件到: {destPath}',
  UMD_FILE_COPY_FAILED: '         ❌ 文件 {fileName} 拷贝失败:',
  UMD_DIR_COPY_FAILED: '      ❌ 目录 {path} 拷贝失败:',
  UMD_SYNC_SUMMARY: '   📊 UMD 同步统计: 拷贝到 {count} 个目录',
  UMD_SKIP_PROJECT_WITH_HTML:
    '   ℹ️  项目 {path} 包含 app.html 和 preview.html，跳过 UMD 同步',
  UMD_FILTERED_PROJECTS: '   📋 过滤后需要同步 UMD 的项目数: {count}',

  // 主流程相关
  SYNC_MODIFY_START: '🔄 开始同步修改代码...',
  BUILD_FAILED: '❌ 同步修改代码失败：构建过程出现错误',
  FILE_SYNC_FAILED: '❌ 同步修改代码失败：文件同步出现错误',
  SYNC_MODIFY_SUCCESS: '✅ 同步修改代码成功',
  SYNC_MODIFY_ERROR: '❌ 同步修改代码执行异常:'
} as const

/**
 * 同步修改代码服务层消息常量
 */
export const SYNC_MODIFY_CODE_SERVICE_MESSAGES = {
  // 互斥控制相关
  OPERATION_IN_PROGRESS_WARNING:
    '⚠️  有同步修改操作正在执行，请等待上次操作完成再尝试',
  OPERATION_IN_PROGRESS: '有同步修改操作正在执行，请等待上次操作完成再尝试',

  // 任务执行相关
  TASK_START: '🔄 开始执行同步修改代码任务...',
  TASK_SUCCESS_LOG: '✅ 同步修改代码任务执行成功',
  TASK_FAILED_LOG: '❌ 同步修改代码任务执行失败',
  TASK_SUCCESS: '同步修改代码任务执行成功',
  TASK_FAILED: '同步修改代码任务执行失败',
  TASK_ERROR: '❌ 同步修改代码任务执行出错:',
  TASK_END: '🏁 同步修改代码任务结束，释放互斥锁',

  // 错误消息前缀
  ERROR_PREFIX: 'Error: '
} as const
