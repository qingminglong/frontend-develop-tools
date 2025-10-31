/**
 * 工作区包信息
 */
export interface WorkspacePackage {
  name: string
  path: string
  srcPath: string
}

/**
 * 工作区配置
 */
export interface WorkspaceConfig {
  packages: string[]
}

/**
 * 变更信息
 */
export interface ChangeInfo {
  timestamp: string
  event: string
  module: string
  file: string
  fullPath: string
}

/**
 * 事件类型
 */
export type EventType = 'add' | 'change' | 'unlink'

/**
 * 事件名称类型
 */
export type EventNameType = '新增' | '修改' | '删除'
