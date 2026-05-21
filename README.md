# AI Compose

AI Compose 是一个面向开发者的 AI 编码环境配置工作台。它采用非聊天的工具链形态，协助开发者对多编辑器的用户级核心配置（提示词与 MCP 服务）进行统一管理与受管应用。

目前已支持的 AI 编辑器目标包括：**Codex**、**Cursor** 以及 **Antigravity**。

## 核心功能

- **Prompt 提示词片段管理**：
  - 按“核心原则、安全约束、测试验证”等语义分类管理提示词片段。
  - 内置开箱即用的中文官方优质预设片段库。
  - 支持自定义片段与组合最终 Prompt 预览。
  - 采用受管区块机制安全应用至各编辑器的全局规则文件（如 `AGENTS.md` / `GEMINI.md`）。

- **MCP (Model Context Protocol) 服务管理**：
  - 支持管理内置的预设 MCP 服务（如 `context7`, `playwright`, `memory`）。
  - 支持添加、更新、删除自定义 MCP 服务。
  - 自动检测并展示配置文件中已存在的外部只读本地配置服务。
  - 一键合并写入或剔除到对应编辑器的物理配置文件（如 `config.toml` / `mcp.json` / `mcp_config.json`）。

## 目录说明

- [docs/prd.md](docs/prd.md)：产品需求文档
- `src/`：前端 React 工作台
- `src-tauri/`：桌面宿主层 (Rust)

## 开发命令

```bash
pnpm install
pnpm build
pnpm lint
pnpm dev
pnpm dev:desktop
```

## 环境说明

运行桌面端需要这些本机依赖：

- `pnpm`
- Rust 工具链：`rustup`、`rustc`、`cargo`
- macOS 完整 `Xcode`

如果暂时只开发前端 UI，可以先使用 `pnpm dev`。
