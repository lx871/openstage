# Mission
- 目标：构建 SillyTavern 数据与交互生态的兼容迁移平台 + 面向现代模型的 Agent Runtime（代号 openstage）
- 背景：ST 为 2021-2023 弱模型时代设计，问题根因是数据模型（线性消息+字符串）、预设（人肉编译提示词）、WI（关键词布尔引擎）、扩展（DOM 注入无沙箱）。重构必须从数据模型与上下文工程层面重做，兼容层作为隔离区继承格式资产
- 约束 / 非目标：
  - 不参考 ST 源码（AGPL-3.0），仅依据公开格式规格与黑盒行为，clean-room
  - 首发仅 OpenAI-compatible Provider；Anthropic 后置
  - 先 Node headless + CLI，React/Tauri 后置
  - 未知字段无损透传；等价校验器 + 参考实现作为 P0 信任基石
- 关键术语：compat/native 双模式、消息树、事件溯源、Prompt IR、InjectionSlot、Recipe