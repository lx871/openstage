# 计划
## P0 兼容内核（✅ 垂直切片闭环 2026-08-19）
- [x] monorepo 脚手架（pnpm + tsconfig paths + vitest + tsx CLI）
- [x] 契约：消息树/事件/状态快照/角色四分离/知识条目/Prompt IR
- [x] domain：ContentPart、状态 delta/full 快照、树折叠投影
- [x] storage：内存事件存储、SQLite 事件表、V2 卡/世界书/聊天导入、知识仓库
- [x] context-engine：预设映射、宏、WI 激活（selectiveLogic/概率/组权重/深度）、预算裁剪、缓存断点、ConversationService
- [x] gateway：能力协商 + OpenAI-compatible（离线镜像 + fetch）
- [x] CLI：import/trace/chat/events + fixture 卡
- [x] 测试 14/14、tsc clean

## P1 上下文现代化
- [ ] SQLite 端到端验证
- [ ] 真实 Provider 流式 + 取消/重试语义
- [ ] Prompt Inspector：block diff、分阶段 token 归因、成本追踪
- [ ] 等价校验器：固定 ST 版本黑盒基准 + 参考实现逐块 diff
- [ ] 分支状态快照 ↔ 消息节点对拍（回滚接线）

## P2 Agent 化
- [ ] Recipe 声明式编译（取代预设旋钮）
- [ ] 分层记忆（工作/情节/语义）+ 混合检索（BM25+向量+图）
- [ ] 工具调用与结构化状态（state.patch/memory.remember）
- [ ] 群聊导演、信息不对称上下文

## P3 生态与部署
- [ ] 沙箱扩展（Worker + 能力清单）、MCP 工具
- [ ] STscript 高频子集 shim + 类型化 Flow
- [ ] React UI、Tauri 桌面、服务器模式、可选同步