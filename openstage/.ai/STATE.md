# 检查点（最后更新：2026-08-19，by opencode）
## 已完成
- monorepo 脚手架（pnpm workspace + tsconfig paths + vitest + CLI）
- 契约层：MessageNode/StateSnapshot/Character 四分离/KnowledgeEntry/事件/Prompt IR 类型
- domain：ContentPart、状态快照(delta/full)、消息树折叠、事件投影、V2 适配
- storage：内存 EventStore + SQLite 事件表、V2 卡/世界书 JSONL/聊天 JSONL/TXT 导入、知识仓库
- context-engine：预设映射、宏、世界书激活(selectiveLogic 0-3/概率/组权重/深度)、预算裁剪、缓存断点、ConversationService
- gateway：能力协商 + OpenAI-compatible 适配器（离线镜像 + fetch 模式）
- CLI：import / trace / chat / events
- 测试 14/14 通过、tsc exit=0；示例卡 fixtures/linwan.json

## 进行中
- 无（P0 垂直切片已闭环）

## 受阻
- 无

## 已完成（P1/P2 增量 2026-08-19）
- SQLite 文件持久化、网关流式/SSE+重试+取消、事件投影状态快照与分支回滚修复
- 新增 @openstage/inspector / @openstage/memory / @openstage/agent / @openstage/extensions / @openstage/recipe
- tools/compat-check 等价校验器，CLI 接 Inspector 报表与 branch 演示
- 测试 21/21、tsc clean，已提交 2ac7baf

## 下一步
1. 接真实 Provider 跑线上流式并落 trace 归档
2. React/Tauri 头部界面