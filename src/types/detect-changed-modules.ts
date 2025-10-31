/**
 * 模块信息接口
 */
export interface ModuleInfo {
  moduleName: string
  modulePath: string
}

/**
 * 工作区包信息
 */
export interface WorkspacePackage {
  name: string
  path: string
  srcPath: string
  packageJsonPath: string
}

/**
 * 工作区配置
 */
export interface WorkspaceConfig {
  packages: string[]
}
