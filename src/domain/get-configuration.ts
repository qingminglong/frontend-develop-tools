import type { ProjectConfig } from '../types/get-configuration.ts'
import { ENV_VARS, SPECIAL_CHARS } from '../consts/index.ts'
import { logToChat, formatMessage } from '../utils/index.ts'

/**
 * 解析环境变量为字符串数组，支持多种格式
 * @param envValue 环境变量值
 * @returns 解析后的字符串数组
 */
function parseEnvArray(envValue: any): string[] {
  // 如果已经是数组，直接返回
  if (Array.isArray(envValue)) {
    return envValue.filter(
      (item) => typeof item === 'string' && item.trim() !== ''
    )
  }

  // 如果不是字符串，返回空数组
  if (typeof envValue !== 'string') {
    return []
  }

  const trimmedValue = envValue.trim()
  if (!trimmedValue) {
    return []
  }

  // 尝试作为 JSON 数组解析
  if (
    trimmedValue.startsWith(SPECIAL_CHARS.BRACKET_LEFT) &&
    trimmedValue.endsWith(SPECIAL_CHARS.BRACKET_RIGHT)
  ) {
    try {
      const parsed = JSON.parse(trimmedValue)
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item) => typeof item === 'string' && item.trim() !== ''
        )
      }
    } catch (error) {
      console.error(`JSON 数组解析失败: ${error}`)
    }
  }

  // 尝试作为逗号分隔的字符串解析
  if (trimmedValue.includes(SPECIAL_CHARS.COMMA)) {
    return trimmedValue
      .split(SPECIAL_CHARS.COMMA)
      .map((item) => item.trim())
      .filter((item) => item !== '')
  }

  // 单个路径
  return [trimmedValue]
}

/**
 * 从命令行参数或配置文件读取配置
 */
export function getConfiguration(): ProjectConfig {
  const projectPatchsEnv = process.env[ENV_VARS.PROJECT_PATCHS]
  const modulePathsEnv = process.env[ENV_VARS.MODULE_PATHS]
  const config: ProjectConfig = {
    modulePaths: [],
    projectPaths: []
  }

  if (projectPatchsEnv || modulePathsEnv) {
    try {
      // 解析 MODULE_PATHS 环境变量
      if (modulePathsEnv) {
        try {
          config.modulePaths = parseEnvArray(modulePathsEnv)
          if (config.modulePaths.length === 0) {
            console.error(`${ENV_VARS.MODULE_PATHS} 解析结果为空`)
          }
        } catch (error) {
          console.error(`${ENV_VARS.MODULE_PATHS} 解析失败: ${error}`)
          config.modulePaths = []
        }
      }

      // 解析 PROJECT_PATCHS 环境变量
      if (projectPatchsEnv) {
        try {
          config.projectPaths = parseEnvArray(projectPatchsEnv)
          if (config.projectPaths.length === 0) {
            console.error(`${ENV_VARS.PROJECT_PATCHS} 解析结果为空`)
          }
        } catch (error) {
          console.error(`${ENV_VARS.PROJECT_PATCHS} 解析失败: ${error}`)
          config.projectPaths = []
        }
      }

      // 如果至少有一个配置有效，则返回配置数组
      if (config.modulePaths.length > 0 || config.projectPaths.length > 0) {
        return config
      }
    } catch (error) {
      console.error(`环境变量配置处理失败: ${error}`)
    }
  }

  // 尝试从旧格式的 PROJECT_CONFIG 环境变量读取（向后兼容）
  const configEnv = process.env[ENV_VARS.PROJECT_CONFIG]
  if (configEnv) {
    try {
      return JSON.parse(configEnv)
    } catch (error) {
      console.error(`${ENV_VARS.PROJECT_CONFIG} 环境变量解析失败: ${error}`)
    }
  }

  // 返回默认配置
  console.error('未找到有效的项目配置，返回空配置')
  return config
}

/**
 * 获取并记录项目路径信息
 * @param messages 消息常量对象
 * @returns 是否有有效的项目路径配置
 */
export function logProjectPaths(messages: any): boolean {
  // 1. 获取项目路径列表
  const { projectPaths } = configuration

  if (!projectPaths || projectPaths.length === 0) {
    logToChat(messages.NO_PROJECT_PATHS)
    return false
  }

  logToChat(
    formatMessage(messages.PROJECT_LIST, {
      count: projectPaths.length
    })
  )
  projectPaths.forEach((p) =>
    logToChat(
      formatMessage(messages.PROJECT_ITEM, {
        path: p
      })
    )
  )

  return true
}

/**
 * 全局配置实例，供其他模块导入使用
 */
export const configuration: ProjectConfig = getConfiguration()

// 使用 console.error 输出到 stderr，避免干扰 MCP 的 stdout 通信
console.error('加载的项目配置:', JSON.stringify(configuration, null, 2))
