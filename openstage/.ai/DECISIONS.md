# 决策日志
## 2026-08-19 项目落地 openstage 子目录
- 决策：在 D:\AIjs\templates\project_root1 (3)\openstage\ 新建独立 monorepo，名称 openstage
- 原因：父目录为多项目模板混杂目录，无可用 TS 骨架；隔离保证干净起步
- 考虑过的替代方案：直接在父目录铺（会与 Python 项目混）

## 2026-08-19 P0 首发仅 OpenAI-compatible
- 决策：网关首发只做 OpenAI-compatible（离线镜像 + fetch 双模式）；Anthropic 后置用于验证缓存断点/工具调用
- 原因：范围最窄、最快出闭环；能力协商接口已为多 Provider 预留

## 2026-08-19 存储层先事件表后全量表
- 决策：conversations/messages 的权威数据源是 events 表（append-only 日志），投影在读取时折叠
- 原因：分支/回滚/同步/审计全部由事件派生；避免双写不一致
- 注意：P0 投影在内存折叠（replay），大数据量后再做物化投影缓存

## 2026-08-19 世界书 selectiveLogic 语义按 ST 官方 0-3 实现
- 决策：OR(0/默认) / AND_ANY(1) / NOT(2) / AND(3)，由 unknownFields.selective + selectiveLogic 驱动
- 原因：fixture 实测发现"条目正文当用户输入"的错乱实现；以社区文档语义为准

## 2026-08-19 依赖策略
- 决策：better-sqlite3 原生绑定已批准构建（pnpm.onlyBuiltDependencies）；运行时若缺失自动退化内存模式
- 原因：Node 22 prebuild 可用，测试验证通过