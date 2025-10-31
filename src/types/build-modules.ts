/**
 * 包依赖信息
 */
export interface PackageDependencyInfo {
  name: string // 包名
  path: string // 包路径
  dependencies: Set<string> // 依赖的包名列表
}

/**
 * 编译模块信息
 */
export interface BuildedModule {
  moduleName: string
  modulePath: string
  reason: 'changed' | 'dependent' // 编译原因：changed-直接变更，dependent-作为依赖被影响
  dependedBy?: string[] // 如果是dependent，记录是被哪些模块依赖的
}
