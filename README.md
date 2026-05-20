# Prompt Workbench

Prompt Workbench 是一个面向开发者的非聊天工作台，用于按语义分类管理提示词片段，并将组合结果应用到用户级 Codex 配置目录。

## 当前方向

- 产品定位：`Codex > Prompt`
- 目标形态：`React + Tauri`
- 当前重点：官方预设片段、最终 Prompt 预览、用户级 Codex 应用闭环

## 目录说明

- [docs/prd.md](/Users/xinghunm/my-house/ai-compose/docs/prd.md)：产品需求文档
- `src/`：前端工作台
- `src-tauri/`：桌面宿主层

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
