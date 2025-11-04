# frontend-develop-tools

前端本地调试和开发工具

## 功能介绍

这是一个基于 MCP (Model Context Protocol) 的前端开发工具服务器，提供以下功能：

### 1. 项目配置管理

支持配置和管理多个前端项目的模块路径和项目路径。

### 2. UI 配置获取

获取阿波罗配置或 UI 配置信息。

### 3. 路径检查

检查配置的路径是否存在及其有效性。

## 安装和构建

```bash
# 安装依赖
npm install

# 构建项目
npm run build
```

## 配置说明

### 配置方式

支持三种配置方式（按优先级排序）：

#### 1. 命令行参数配置（最高优先级）

使用 `--config` 参数指定配置文件路径：

```bash
node build/index.js --config=/path/to/config.json
```

#### 2. 环境变量配置

设置 `PROJECT_CONFIG` 环境变量：

```bash
export PROJECT_CONFIG='[{"modulePaths":["/home/git/frontend"],"projectPaths":["/home/git/frontend-cli"]}]'
node build/index.js
```

#### 3. 默认配置

如果未提供任何配置，将使用默认配置：

```json
[
  {
    "modulePaths": ["/home/git/frontend"],
    "projectPaths": ["/home/git/frontend-cli"]
  }
]
```

### 配置文件格式

配置文件是一个 JSON 数组，每个元素包含以下字段：

```json
[
  {
    "modulePaths": ["/home/git/frontend", "/home/git/frontend/core"],
    "projectPaths": ["/home/git/frontend-cli", "/home/git/frontend-tools"]
  }
]
```

- `modulePaths`: 模块路径数组，指向前端模块所在的目录
- `projectPaths`: 项目路径数组，指向相关项目所在的目录

可参考 `config.example.json` 文件。

## 可用工具

### 1. get-project-config

获取项目配置信息。

**参数：**

- `index` (可选): 配置索引，不提供则返回所有配置

**示例：**

```javascript
// 获取所有配置
{ "index": undefined }

// 获取索引为0的配置
{ "index": 0 }
```

### 2. check-paths

检查配置的路径是否存在。

**参数：**

- `configIndex` (可选): 要检查的配置索引，不提供则检查所有配置

**返回信息包括：**

- 路径是否存在
- 是否为目录
- 完整的路径信息

### 3. ui-config

获取阿波罗配置或 UI 配置。

**参数：** 无

## 使用示例

### 1. 创建配置文件

```bash
cp config.example.json config.json
# 编辑 config.json，设置你的项目路径
```

### 2. 启动服务器

```bash
# 使用配置文件启动
node build/index.js --config=./config.json

# 或使用环境变量
export PROJECT_CONFIG='[{"modulePaths":["/path/to/modules"],"projectPaths":["/path/to/projects"]}]'
node build/index.js
```

### 3. 在 Cursor 中使用

将此 MCP 服务器配置到 Cursor 的 MCP 设置中，即可在 AI 对话中使用上述工具。

## 开发

### 目录结构

```
frontend-develop-tools/
├── src/
│   ├── index.ts              # 主入口文件
│   └── detect-changed-modules.ts
├── build/                     # 编译输出目录
├── config.example.json       # 配置示例文件
└── README.md                 # 文档
```

### 监控模式

参考 `WATCH_MODULES_USAGE.md` 了解如何使用模块监控功能。

## 注意事项

1. 确保配置的路径存在且具有访问权限
2. 路径建议使用绝对路径
3. 配置文件必须是有效的 JSON 格式
4. 多个配置可以同时存在，通过索引访问不同的配置

## 故障排查

### 配置无法加载

- 检查配置文件路径是否正确
- 确认配置文件是有效的 JSON 格式
- 查看控制台输出的配置加载日志

### 路径检查失败

- 确认路径存在且可访问
- 检查路径权限
- 使用绝对路径而非相对路径

## License

MIT
