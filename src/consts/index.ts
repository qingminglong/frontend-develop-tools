/**
 * 文件和目录常量
 */
export const FILE_NAMES = {
  WORKSPACE_CONFIG: 'pnpm-workspace.yaml',
  PACKAGE_JSON: 'package.json',
  SRC_DIR: 'src'
} as const

/**
 * 文件编码常量
 */
export const ENCODINGS = {
  UTF8: 'utf8'
} as const

/**
 * package.json 字段常量
 */
export const PACKAGE_FIELDS = {
  NAME: 'name',
  DEPENDENCIES: 'dependencies',
  DEV_DEPENDENCIES: 'devDependencies',
  PACKAGES: 'packages'
} as const

/**
 * 依赖类型数组
 */
export const DEPENDENCY_TYPES = [
  PACKAGE_FIELDS.DEPENDENCIES,
  PACKAGE_FIELDS.DEV_DEPENDENCIES
] as const

/**
 * Git 命令常量
 */
export const GIT_COMMANDS = {
  DIFF_NAME_ONLY: 'git diff --name-only',
  DIFF_CACHED_NAME_ONLY: 'git diff --cached --name-only',
  LS_FILES_UNTRACKED: 'git ls-files --others --exclude-standard'
} as const

/**
 * 环境变量名称常量
 */
export const ENV_VARS = {
  PROJECT_PATCHS: 'PROJECT_PATCHS',
  MODULE_PATHS: 'MODULE_PATHS',
  PROJECT_CONFIG: 'PROJECT_CONFIG'
} as const

/**
 * 模块变更原因常量
 */
export const BUILD_REASON = {
  CHANGED: 'changed',
  DEPENDENT: 'dependent'
} as const

/**
 * 文件事件类型常量
 */
export const FILE_EVENTS = {
  ADD: 'add',
  CHANGE: 'change',
  UNLINK: 'unlink'
} as const

/**
 * 事件名称映射（中文）
 */
export const EVENT_NAMES = {
  ADD: '新增',
  CHANGE: '修改',
  UNLINK: '删除'
} as const

/**
 * 监控器状态常量
 */
export const WATCHER_STATUS = {
  ALREADY_WATCHING: 'already_watching',
  STARTED: 'started',
  FAILED: 'failed'
} as const

/**
 * 终端颜色代码常量
 */
export const ANSI_COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m'
} as const

/**
 * Chokidar 监控配置常量
 */
export const CHOKIDAR_CONFIG = {
  IGNORED_PATTERNS: [
    /(^|[\/\\])\../, // 忽略隐藏文件
    '**/node_modules/**', // 忽略node_modules
    '**/dist/**', // 忽略构建产物
    '**/*.map' // 忽略source map
  ] as Array<RegExp | string>,
  STABILITY_THRESHOLD: 100, // 文件稳定100ms后才触发
  POLL_INTERVAL: 50
} as const

/**
 * 日期格式化配置
 */
export const DATE_FORMAT_OPTIONS = {
  hour12: false,
  year: 'numeric' as const,
  month: '2-digit' as const,
  day: '2-digit' as const,
  hour: '2-digit' as const,
  minute: '2-digit' as const,
  second: '2-digit' as const
}

/**
 * 特殊字符常量
 */
export const SPECIAL_CHARS = {
  EXCLAMATION: '!',
  NEWLINE: '\n',
  COMMA: ',',
  BRACKET_LEFT: '[',
  BRACKET_RIGHT: ']',
  PARENT_DIR: '..',
  SEPARATOR: '='
} as const

/**
 * 错误消息常量
 */
export const ERROR_MESSAGES = {
  UNKNOWN_ERROR: 'Unknown error',
  NO_MODULE_PATHS: '没有配置需要监控的模块路径',
  PATH_NOT_EXISTS: '项目路径不存在',
  WORKSPACE_FILE_NOT_FOUND: '在项目路径中找不到 pnpm-workspace.yaml 文件',
  NO_WORKSPACE_PACKAGES: '未找到任何工作区包',
  NO_FILE_CHANGES: '未检测到任何文件变更'
} as const

/**
 * 日志消息常量
 */
export const LOG_MESSAGES = {
  ANALYZE_START: '🔍 开始分析需要编译的模块...\n',
  NO_CHANGES_SKIP: '⏭️  项目 {path} 没有变更的模块，跳过\n',
  PROJECT_PATH: '📂 项目路径: {path}',
  MODULES_DETECTED: '📦 检测到 {count} 个变更的模块:',
  NO_DEPENDENCY_INFO: '⚠️  未找到任何包依赖信息，仅编译变更的模块',
  BUILD_TOTAL: '\n✅ 共需编译 {count} 个模块（包含依赖）:',
  CIRCULAR_DEPENDENCY: '检测到循环依赖: {name}',
  ALL_MODULES_READY: '✅ 模块编译前的准备工作完成，开始编译...',
  BUILD_NOT_READY: '⚠️  正在获取待编译的模块或未有模块变动无需编译',
  NO_MODULES_TO_BUILD: 'ℹ️  没有需要编译的模块',
  BUILD_START: '\n🔨 开始编译 {count} 个模块...\n',
  BUILD_COMPLETE: '🎉 所有模块编译完成！\n',
  INIT_LISTENER: '📡 初始化编译监听器...',
  LISTENER_READY: '✅ 编译监听器初始化完成\n',
  READY_TRIGGER: '🔔 检测到 isReady 变为 true，开始执行编译...',
  MONITORING_PROJECT: '📂 监控项目: {path}\n',
  NO_SRC_MODULES: '⚠️  警告: 没有找到包含 src 目录的模块',
  CHECK_CONFIG: '   请检查 pnpm-workspace.yaml 配置和包目录结构',
  MODULES_FOUND: '📦 找到 {count} 个包含 src 目录的模块:\n',
  START_WATCHING: '\n👀 开始监控文件变化...\n',
  WATCH_ERROR: '❌ 监控错误: {error}'
} as const

/**
 * 地区常量
 */
export const LOCALES = {
  ZH_CN: 'zh-CN'
} as const

/**
 * Node.js 依赖管理相关目录常量
 */
export const NODE_DIRS = {
  NODE_MODULES: 'node_modules',
  PNPM_DIR: '.pnpm'
} as const

/**
 * 编译输出目录常量
 */
export const BUILD_OUTPUT_DIRS = ['dist', 'es', 'lib'] as const

/**
 * UMD 相关目录常量
 */
export const UMD_DIRS = {
  UMD_DIR: 'umd',
  DIST_DIR: 'dist'
} as const

/**
 * 包管理器命令常量
 */
export const PACKAGE_MANAGER_COMMANDS = {
  PNPM_INSTALL: 'pnpm install'
} as const

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
  UMD_FILE_COPIED: '      ✅ 已拷贝到: {destPath}',
  UMD_FILE_COPY_FAILED: '      ❌ 拷贝失败:',
  UMD_NO_MATCH: '      ℹ️  未找到匹配的文件',
  UMD_SYNC_SUMMARY: '\n   📊 UMD 同步统计: 拷贝了 {count} 个文件',

  // 主流程相关
  SYNC_MODIFY_START: '🔄 开始同步修改代码...',
  BUILD_FAILED: '❌ 同步修改代码失败：构建过程出现错误',
  FILE_SYNC_FAILED: '❌ 同步修改代码失败：文件同步出现错误',
  SYNC_MODIFY_SUCCESS: '✅ 同步修改代码成功',
  SYNC_MODIFY_ERROR: '❌ 同步修改代码执行异常:'
} as const
