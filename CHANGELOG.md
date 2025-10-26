# 变更日志

## [未发布] - 2025-10-26

### 新增功能

#### 项目配置管理

- 支持通过对象数组配置多个项目的模块路径和项目路径
- 配置格式：`[{ modulePaths: [...], projectPaths: [...] }]`

#### 多种配置方式

1. **命令行参数配置** (最高优先级)
   - 使用 `--config=/path/to/config.json` 指定配置文件
2. **环境变量配置**
   - 使用 `PROJECT_CONFIG` 环境变量传递 JSON 配置
3. **默认配置** (最低优先级)
   - 默认使用 `/home/git/frontend` 和 `/home/git/frontend-cli`

#### 新增 MCP 工具

1. **get-project-config**

   - 获取项目配置信息
   - 支持通过索引获取特定配置
   - 支持获取所有配置

2. **check-paths**
   - 检查配置的路径是否存在
   - 验证路径是否为有效目录
   - 支持检查指定配置或所有配置

### 优化改进

#### 代码结构

- 添加了 `ProjectConfig` 接口定义，提高类型安全性
- 实现了 `loadConfiguration()` 函数，统一配置加载逻辑
- 所有工具使用 Zod schema 进行参数验证

#### 错误处理

- 配置文件读取失败时的错误提示
- 配置索引越界检查
- 路径检查异常处理

#### 日志输出

- 启动时输出加载的配置信息
- 便于调试和配置验证

### 文档更新

#### 新增文件

- `config.example.json`: 配置文件示例
- `test-config.sh`: 配置测试脚本
- `CHANGELOG.md`: 变更日志

#### 更新文件

- `README.md`: 完整的使用文档和配置说明
- `src/index.ts`: 主入口文件优化

### 技术细节

#### 依赖项

- 新增 `fs` 和 `path` 模块用于文件操作
- 使用 `zod` 进行参数验证

#### 类型定义

```typescript
interface ProjectConfig {
  modulePaths: string[]
  projectPaths: string[]
}
```

#### 配置加载优先级

```
命令行参数 > 环境变量 > 默认配置
```

### 使用示例

#### 通过配置文件

```bash
node build/index.js --config=./config.json
```

#### 通过环境变量

```bash
export PROJECT_CONFIG='[{"modulePaths":["/path/to/modules"],"projectPaths":["/path/to/projects"]}]'
node build/index.js
```

#### 使用默认配置

```bash
node build/index.js
```

### 兼容性

- 保持了原有 `ui-config` 工具的完整功能
- 新增功能不影响现有功能的使用
- 向后兼容

### 测试建议

1. 测试默认配置加载
2. 测试配置文件加载
3. 测试环境变量配置
4. 测试配置优先级
5. 测试路径检查功能
6. 测试配置获取功能

### 后续计划

- [ ] 添加配置验证功能
- [ ] 支持配置文件热重载
- [ ] 添加更多路径操作工具
- [ ] 完善错误提示信息
- [ ] 添加单元测试
