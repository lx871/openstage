# openstage

SillyTavern 数据与交互生态的兼容迁移平台 + 面向现代模型的 Agent Runtime。

## 设计立场

- **兼容层是隔离区，不是地基**：核心数据模型干净自洽；ST 格式（V1/V2/V3 卡、世界书、预设、聊天）通过适配器双向转换，未知字段无损透传。
- **消息是不可变事件**：树状会话、状态快照、可回放，全由事件日志投影派生。
- **上下文工程与 UI 分离**：headless TypeScript 核心，CLI 已可驱动；React/Tauri/浏览器后置。
- **双模式**：compat（逐块复现 ST 语义）+ native（Recipe 声明式编译），导入即用。

## 路线达成

- **P0/P1（已完成）**：契约/存储/导入/兼容编译/离线闭环/流式网关重试与取消/SSE/分支状态回滚/Inspector/等价校验器
- **P2/P3（骨架已就绪）**：Recipe（`@openstage/recipe`）、分层记忆（`@openstage/memory`）、工具/Agent（`@openstage/agent`）、沙箱扩展（`@openstage/extensions`）

| 能力 | 状态 |
|---|---|
| 角色卡 V2 JSON/PNG 导入（身份/呈现/行为四分离） | ✅ |
| 世界书导入（keys/keysecondary·selectiveLogic·概率·组权重·深度·position） | ✅ |
| 聊天 JSONL/TXT 解析 | ✅ |
| 事件溯源存储（内存 + SQLite 文件持久化） | ✅ |
| 预设 → Prompt 块映射、宏、提示词编译（稳定→易变 + 缓存断点+预算） | ✅ |
| 网关：流式/SSE、取消(AbortSignal)、重试与指数退避、offline 镜像 | ✅ |
| Inspector（planToReport/whyNotInjected/estimatePlanCost + diffPlans） | ✅ |
| 等价校验器（compat-check：未知字段透传与双模式 diff） | ✅ |
| Recipe 声明式编译、分层记忆、工具/Agent、沙箱扩展 | ✅（可运行骨架） |
| 卡片转换器 V1/V2/V3 ↔ openstage 双向（含 PNG 嵌入） | ✅ |
| Web 前端（Vite+React，聊天/角色/世界书/Inspector/设置/转换） | ✅ |

## 快速开始

```bash
pnpm install
pnpm typecheck                          # tsc --noEmit
pnpm test                               # vitest（24）
pnpm web:build                          # 构建 Web 前端

pnpm cli import tests/fixtures/linwan.json
pnpm cli convert tests/fixtures/linwan.json --to v3 --out /tmp/card.v3.json  # V2→V3 转写
pnpm cli trace  tests/fixtures/linwan.json --turn 2   # 含 Inspector 报表
pnpm cli branch tests/fixtures/linwan.json            # 分支+状态演示
pnpm exec tsx tools/compat-check/src/index.ts tests/fixtures/linwan.json
pnpm cli chat   tests/fixtures/linwan.json --offline  # 离线镜像对话

# Web 前端
pnpm --filter @openstage/web exec vite --port 5173  # 或 pnpm cli web
```

Privacy: no telemetry; keys are transient via env vars only (see `PRIVACY.md`).

## 目录

```
packages/
  contracts/        契约类型
  domain/           ContentPart/状态快照/树折叠/投影
  storage/          事件存储（内存/SQLite 文件）+ 导入器 + 知识仓库
  context-engine/   宏·世界书激活·预设映射·提示词编译·会话服务
  gateway/          Provider 能力协商 + OpenAI-compatible（含 SSE/重试/取消）
  inspector/        报表/归因/成本/差分
  memory/           working/episodic/semantic + summarize/extractFacts
  agent/            工具注册与调度（state.patch/memory.remember/dice.roll）
  extensions/       能力授权清单 + Worker 沙箱主机位
  recipe/           声明式 Recipe 封装（compat/native 两个预设配方）
  card-converter/   ST V1/V2/V3 ↔ openstage 双向（含 PNG tEXt 嵌入）
apps/web/           Web 前端（Vite+React，browser 隔离存储）
tools/
  cli/              import/convert/trace/branch/chat/web/events（含 Inspector 输出）
  compat-check/     等价校验器
tests/fixtures/     示例角色卡（林晚）
```

> clean-room 声明：本实现仅依据公开格式规格与黑盒行为设计，不参考 ST 源码（AGPL-3.0）。
