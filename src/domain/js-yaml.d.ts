/**
 * js-yaml 类型声明文件
 * 仅声明本项目中使用到的 API
 */
declare module 'js-yaml' {
  /**
   * 将 YAML 字符串解析为 JavaScript 对象
   * @param str - YAML 字符串
   * @param options - 解析选项
   * @returns 解析后的 JavaScript 对象
   */
  export function load(str: string, options?: any): any

  /**
   * 将 JavaScript 对象转换为 YAML 字符串
   * @param obj - JavaScript 对象
   * @param options - 转换选项
   * @returns YAML 字符串
   */
  export function dump(obj: any, options?: any): string
}
