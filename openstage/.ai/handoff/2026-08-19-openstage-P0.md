# 交接 2026-08-19 openstage P0 垂直切片

## 本次做了什么
- 从零搭建 openstage monorepo（pnpm workspace + tsconfig paths + vitest + tsx）
- 完成 P0 垂直切片：契约 → 事件存储（内存+SQLite）→ V2 卡/世界书/聊天导入 → 兼容上下文编译（宏/预设/WI/预算/缓存断点）→ 会话服务 → CLI（import/trace/chat）
- 14/14 测试通过，tsc clean

## 为什么这么做
- 用户目标（SillyTavern 重构）需要先证明三件事：数据可导入无损、compat 模式提示词可解释、Inspector 能讲清每一块的来源/顺序/裁剪原因——P0 切片即此证明的离线版

## 停在哪里
- P1 起点：SQLite 端到端、真实 Provider 流式、Prompt Inspector、等价校验器
- 已知缺口（设计内后置）：分支状态快照回滚未接线（MessageNode.stateSnapshotId 已建模）、聊天导入器未接 UI、groupWeight 组选择用加权不选最高、深度注入只保留顺序不重排历史内 WI

## 下一步建议
1. SQLite 链路测试（`store.replay` 走 events 表回放）
2. 等价校验器：装一个固定版本 ST 做黑盒基准，diff 参考实现输出（P0 信任基石）
3. Inspector：block diff + 分阶段 token 归因（plan.budget 已有数据）
4. 真实 OpenAI-compatible 流式（gateway 的 fetch 模式已写，接 stream 事件即可）

## 已知坑 / 注意事项
- vitest 别名用 fileURLToPath 解析；tsconfig paths 与 vitest alias 两份配置需同步维护
- better-sqlite3 是原生绑定：pnpm.onlyBuiltDependencies 已批准；换机器重装需 `pnpm rebuild better-sqlite3`
- CLI 的 chat 命令交互走 stdin；离线模式回复是确定性镜像（非真实模型）
- 父目录 `.ai/` 是 project_root1 的记忆，与本项目无关；openstage 使用自己的 `.ai/`