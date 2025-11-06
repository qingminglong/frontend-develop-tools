/**
 * 同步单个模块服务层消息常量
 */
export const SYNC_SINGLE_MODULE_SERVICE_MESSAGES = {
  // 互斥控制相关
  OPERATION_IN_PROGRESS_WARNING:
    '⚠️ 有同步单个模块操作正在执行，请等待上次操作完成再尝试',
  OPERATION_IN_PROGRESS: '有同步单个模块操作正在执行，请等待上次操作完成再尝试',

  // 任务执行相关
  TASK_START: '🔄 开始执行同步单个模块任务...',
  TASK_SUCCESS_LOG: '✅ 同步单个模块任务执行成功',
  TASK_FAILED_LOG: '❌ 同步单个模块任务执行失败',
  TASK_SUCCESS: '同步单个模块任务执行成功',
  TASK_FAILED: '同步单个模块任务执行失败',
  TASK_ERROR: '❌ 同步单个模块任务执行出错:',
  TASK_END: '🏁 同步单个模块任务结束，释放互斥锁',

  // 错误消息前缀
  ERROR_PREFIX: 'Error: ',

  // 输入验证
  MISSING_INPUT:
    '缺少必需参数：userInput。请提供包含模块名的输入，例如："同步@ida/ui模块下修改内容"',
  INVALID_INPUT: 'userInput 参数必须是非空字符串'
} as const

/**
 * 同步单个模块领域层消息常量
 */
export const SYNC_SINGLE_MODULE_DOMAIN_MESSAGES = {
  // 主要操作流程消息
  SYNC_START: '🔄 开始同步指定模块的修改代码...\n',
  EXTRACT_MODULE_SUCCESS: '✅ 提取到模块名: {moduleName}',
  MODULE_NOT_FOUND: '❌ 在配置中未找到模块: {moduleName}',
  SYNC_BUILD_FAILED: '❌ 同步指定模块失败：构建过程出现错误',
  SYNC_FAILED: '❌ 同步指定模块失败：文件同步出现错误',
  SYNC_SUCCESS: '✅ 同步指定模块成功',
  SYNC_EXCEPTION: '❌ 同步指定模块执行异常:',

  // 模块提取相关
  EXTRACT_MODULE_FAILED: '❌ 无法从用户输入中提取模块名',
  USER_INPUT: '   用户输入: {input}',
  EXTRACTION_HINT:
    '   提示: 请确保输入包含模块名，例如 "同步@ida/ui模块下修改内容"',

  // 配置查找相关
  CONFIG_MODULES_NOT_FOUND: '⚠️ 配置中未找到模块路径 (modulePaths)',

  // 包处理相关
  PACKAGE_JSON_READ_FAILED: '   ⚠️ 读取 package.json 失败: {path}',
  SKIP_MODULE_PATH: '   ⚠️ 跳过 {path}: 未找到工作区包',
  PACKAGES_FOUND: '   📦 在 {path} 中找到 {count} 个包',
  MODULE_MATCH_FOUND: '   ✅ 找到匹配的模块: {packageName} (路径: {path})',

  // 模块缓存相关
  MODULE_CACHED: '📦 模块信息已缓存到全局变量',
  CACHE_PROJECT_PATH: '   项目路径: {path}',
  CACHE_MODULE_NAME: '   模块名: {moduleName}',
  CACHE_MODULE_PATH: '   模块路径: {path}',

  // 构建相关
  NO_MODULES_TO_BUILD: '⚠️ 没有需要编译的模块',
  BUILD_MODULES_START: '\n🔨 开始编译 {count} 个模块...\n',
  BUILDING_MODULE: '[1/{total}] 编译模块: {moduleName}',
  MODULE_PATH: '   路径: {path}',
  PACKAGE_JSON_NOT_FOUND: '   ⚠️ 未找到 package.json，跳过编译',
  BUILD_SCRIPT_NOT_FOUND: '   ⚠️ 未找到 scripts.build 配置，跳过编译',
  BUILD_COMMAND: '   🔨 执行编译命令: pnpm run build',
  BUILD_SUCCESS: '   ✅ 编译成功 (耗时: {duration}s)\n',
  BUILD_FAILED: '   ❌ 编译失败:',
  BUILD_EXCEPTION: '❌ 编译模块时出错:',
  BUILD_STATS: '\n📊 编译统计:',
  BUILD_SUCCESS_COUNT: '   ✅ 成功: {count}',
  BUILD_FAIL_COUNT: '   ❌ 失败: {count}',
  BUILD_TOTAL_COUNT: '   📦 总计: {count}\n',
  BUILD_PARTIAL_FAIL: '❌ 编译完成，但有 {count} 个模块编译失败',
  BUILD_ALL_SUCCESS: '🎉 所有模块编译完成！\n',

  // UMD同步相关
  UMD_DIR_NOT_FOUND: 'UMD 目录不存在: {moduleName}',
  UMD_DIR_FOUND: '找到 UMD 目录: {path}',
  UMD_FILES_FOUND: 'UMD 目录下找到 {count} 个文件',
  UMD_FILE_ITEM: '   📄 {fileName}',
  POSTINSTALL_NOT_FOUND: '未找到 postinstall.js 文件: {path}，跳过 UMD 同步',
  POSTINSTALL_EMPTY: 'postinstall.js 文件为空，跳过 UMD 同步',
  UMD_DETECT_RENDER: '检测到 public/umd/render 关键字，将拷贝到该路径',
  UMD_DETECT_PUBLIC: '检测到 public/umd 关键字，将拷贝到该路径',
  UMD_KEYWORD_NOT_FOUND:
    'postinstall.js 中未找到 public/umd/render 或 public/umd 关键字，跳过 UMD 同步',
  UMD_PREPARE_COPY: '准备拷贝 UMD 文件到: {path}',
  UMD_CREATE_DIR: '创建目标目录: {path}',
  UMD_COPY_SUCCESS: '✅ UMD 文件拷贝成功: {destPath} ({count} 个文件)',
  UMD_COPY_FAILED: '❌ UMD 文件拷贝失败: {fileName}',
  UMD_COPY_EXCEPTION: '拷贝 UMD 文件到项目失败: {path}',

  // 通用格式化模板
  PREPARE_COPY_UMD: '准备拷贝 UMD 文件到: {path}',
  COPY_TO_PROJECT_FAILED: '拷贝 UMD 文件到项目失败: {path}'
} as const
