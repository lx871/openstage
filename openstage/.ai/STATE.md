# 检查点（最后更新：2026-08-19，by opencode）
## 已完成
- P0 垂直切片：契约/领域/存储(内存+SQLite 文件)/兼容上下文引擎/网关/CLI + 14/14 测试
- P1 收敛：SQLite 文件持久化、网关流式/SSE+AbortSignal 取消+指数退避重试、事件投影分支回滚与状态快照修复
- P2 骨架：@openstage/recipe(compat/native 配方)、@openstage/memory(三层+聚合)、@openstage/agent(state.patch/memory.remember/dice)、@openstage/extensions(能力清单沙箱)、@openstage/inspector(报表/归因/成本/diff)、tools/compat-check 等价校验器
- 工程收敛：pnpm typecheck 0、vitest 21/21、scripts/smoke.ps1 一键绿灯(f4eab0a)
- 文档：README/QUICKSTART/docs stub 齐备，新 clone 5 步可复现

## 进行中
- 无（整个项目已达“可交付骨架”里程碑）

## 受阻
- 无

## 下一步（可选演进）
1. 接真实 Provider（OPENAI_API_KEY）跑线上流式并落 trace 归档
2. React/Tauri 头部界面与 Prompt Inspector 视图