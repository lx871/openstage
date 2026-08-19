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

## 下一步
1. SQLite 存储端到端验证（当前仅内存链路测过；sqlite-store 依赖 better-sqlite3 原生绑定）
2. P1：真实 Provider 流式、Prompt Inspector（block diff/分阶段 token 归因）
3. 等价校验器：固定 ST 版本黑盒基准 + 参考实现 diff 工具（迁移信任基石）
4. 分支状态快照回滚接线（MessageNode.stateSnapshotId ↔ state.snapshot.created 事件对拍）