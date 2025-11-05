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
