# openstage

SillyTavern 数据与交互生态的兼容迁移平台 + 面向现代模型的 Agent Runtime（P0 骨架）。

## 设计立场

- **兼容层是隔离区，不是地基**：核心数据模型干净自洽；ST 格式（V1/V2/V3 卡、世界书、预设、聊天）通过适配器双向转换，未知字段无损透传。
- **消息是不可变事件**：树状会话、状态快照、可回放，全由事件日志投影派生。
- **上下文工程与 UI 分离**：headless TypeScript 核心，CLI 已可驱动；React/Tauri/浏览器后置。
- **双模式**：compat（逐块复现 ST 语义）+ native（Recipe/检索/缓存规划），导入即用。

## 当前状态（P0 垂直切片）

| 能力 | 状态 |
|---|---|
| 角色卡 V2 JSON/PNG 导入（身份/呈现/行为四分离） | ✅ |
| 世界书导入（keys/keysecondary·selectiveLogic·概率·组权重·深度·position） | ✅ |
| 聊天 JSONL/TXT 解析 | ✅（导入器就绪，未接 UI） |
| 事件溯源存储（内存 + SQLite/better-sqlite3） | ✅ |
| 预设 → Prompt 块映射（marker → 注入槽位） | ✅ |
| 宏求值（char/user/time/date + 未解析报告） | ✅ |
| 提示词编译：稳定→半稳定→易变 + 缓存断点 + 预算裁剪 | ✅ |
| 流式/真实 Provider 请求 | ⬜（离线镜像网关就绪，HTTP 适配器已写） |

## 快速开始

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest

pnpm cli import  tests/fixtures/linwan.json
pnpm cli trace   tests/fixtures/linwan.json --turn 2
pnpm cli chat    tests/fixtures/linwan.json --offline   # 交互式对话（离线镜像回复）
```

## 目录

```
packages/
  contracts/        契约类型（消息树/事件/角色/知识/Prompt IR）
  domain/           纯函数领域逻辑（ContentPart/状态快照/树折叠/适配器）
  storage/          事件存储（内存/SQLite）+ V2/世界书/聊天导入器 + 知识仓库
  context-engine/   宏 · 世界书激活 · 预设映射 · 提示词编译与预算 · 会话服务
  gateway/          Provider 能力协商 + OpenAI-compatible 适配器
tools/cli/          import / trace / chat / events
tests/fixtures/     示例角色卡（林晚，含世界书与示例对话）
```

## 路线

- **P0**（本次）：契约 + 存储 + 导入 + 兼容编译 + 离线闭环 —— ✅
- **P1**：真实 Provider 流式、Inspector（diff/归因）、分组/递归 WI 细节、分支状态快照回滚
- **P2**：Recipe 声明式编译、分层记忆、混合检索、缓存断点终端对齐
- **P3**：工具调用/结构化状态、群聊导演、STscript shim、沙箱扩展

> clean-room 声明：本实现仅依据公开格式规格与黑盒行为设计，不参考 ST 源码（AGPL-3.0）。