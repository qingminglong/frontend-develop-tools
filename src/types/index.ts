/**
 * 统一导出所有类型定义
 */

export type { PackageDependencyInfo, BuildedModule } from './build-modules'
export type {
  ModuleInfo,
  WorkspacePackage as DetectWorkspacePackage,
  WorkspaceConfig as DetectWorkspaceConfig
} from './detect-changed-modules'
export type { ProjectConfig } from './get-configuration'
export type {
  WorkspacePackage as WatchWorkspacePackage,
  WorkspaceConfig as WatchWorkspaceConfig,
  ChangeInfo,
  EventType,
  EventNameType
} from './watch-modules'
