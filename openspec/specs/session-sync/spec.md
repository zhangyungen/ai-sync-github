# session-sync Specification

## Purpose
定义会话采集、手动/自动同步、增量与去重、失败处理和日志可观测能力，确保插件可稳定将多站点会话增量发布到 GitHub。

## Requirements
### Requirement: Support Manual Session Sync
系统 SHALL 提供手动同步能力，允许用户显式选择要同步的聊天会话后执行同步。

#### Scenario: User selects sessions for one-time sync
- **GIVEN** 用户已完成插件与 GitHub 目标仓库的基础配置
- **WHEN** 用户在手动同步界面选择一个或多个会话并点击“手动同步”
- **THEN** 系统执行同步并将结果写入配置的发布目录

### Requirement: Support Scheduled Incremental Sync
系统 SHALL 支持自动定时同步，仅同步每个会话自上次成功同步后的新增内容；同步周期必须可配置且受可配置范围约束。

#### Scenario: Scheduler runs periodic incremental sync
- **GIVEN** 自动同步已启用且会话存在历史游标
- **WHEN** 到达调度周期
- **THEN** 系统只抓取并发布新增消息，不重复同步已发布内容

#### Scenario: User sets sync interval outside allowed range
- **GIVEN** 系统定义了自动同步周期允许范围
- **WHEN** 用户配置的周期超出允许范围
- **THEN** 系统拒绝保存配置并提示用户调整

### Requirement: Auto Sync Must Collect Open Supported Chat Tabs Before Run
系统 SHALL 在自动同步执行前先扫描并采集已打开的受支持聊天站点标签页会话，再进入同步流程。

#### Scenario: Auto sync run collects open chat tabs first
- **GIVEN** 浏览器中存在 ChatGPT、DeepSeek 或千问会话标签页
- **WHEN** 用户点击“立即自动同步”或 alarm 触发自动同步
- **THEN** 系统 MUST 先尝试采集这些标签页会话
- **AND** 随后基于最新采集结果执行自动同步

### Requirement: Deduplicate Sync Data in Recent 24 Hours
系统 SHALL 在最近 24 小时窗口内对已处理消息执行去重，避免短周期调度导致重复同步。

#### Scenario: Duplicate message appears in repeated polling within 24 hours
- **GIVEN** 同一条消息在 24 小时内被重复扫描到
- **WHEN** 自动同步任务处理该消息
- **THEN** 系统识别重复并跳过该消息的再次发布

### Requirement: Normalize Multi-Type Chat Content
系统 SHALL 在同步前将聊天内容标准化为统一领域模型，覆盖文本、代码块、Markdown、链接、图片/附件引用等可见内容类型。

#### Scenario: Session contains mixed content types
- **GIVEN** 某会话包含文本、代码块和图片引用
- **WHEN** 系统执行同步标准化流程
- **THEN** 所有消息被转换为统一结构并可进入后续分类与渲染阶段

### Requirement: Manual Sync Must Support Batch Sessions and Optional Tags
系统 SHALL 在手动同步中支持批量会话选择，并允许角色、业务主题、目录标签为空输入。

#### Scenario: Manual sync with multiple sessions
- **GIVEN** 用户在手动同步界面选中多个会话
- **WHEN** 用户提交手动同步
- **THEN** 系统 MUST 逐会话执行同步并返回批次汇总结果

#### Scenario: Manual sync with empty tag selection
- **GIVEN** 用户已选择至少一个会话
- **WHEN** 用户未选择任何角色、业务主题和目录标签
- **THEN** 系统 MUST 接受该请求并继续同步

### Requirement: Support Multi-Site Session Collection
系统 SHALL 支持从 ChatGPT、DeepSeek、千问页面采集当前会话，并纳入统一同步流程。

#### Scenario: Collect active session from supported chat site
- **GIVEN** 当前活动标签页为受支持会话页面
- **WHEN** 用户点击“采集当前会话”
- **THEN** 系统 MUST 返回包含 sessionId、title、messages 的会话快照

#### Scenario: Retry by content script reinjection when channel is missing
- **GIVEN** 发送采集消息时 content script 接收端不存在
- **WHEN** 标签页 URL 为受支持站点
- **THEN** 系统 MUST 尝试重新注入采集脚本并重试一次

### Requirement: Resolve Session Title from Conversational Content
系统 SHALL 在页面标题通用或无效时，从会话内容推断并清洗标题。

#### Scenario: Generic site title should not be used as final session title
- **GIVEN** 页面标题为站点通用标题（例如官网标题）
- **WHEN** 系统采集会话
- **THEN** 系统 MUST 优先使用页面会话标题或首条用户消息摘要作为会话标题

### Requirement: Incremental Sync Must Detect Message Content Mutation
系统 SHALL 在自动同步中同时基于消息 ID 与消息签名判定增量。

#### Scenario: Last message id is unchanged but content has changed
- **GIVEN** 自动同步游标命中最后一条消息 ID
- **WHEN** 该消息内容签名与上次同步签名不一致
- **THEN** 系统 MUST 将该消息视为增量内容并执行同步

### Requirement: Session-Level Failure Must Not Abort Batch Sync
系统 SHALL 将失败隔离在会话粒度：单会话同步失败不应中断同批次其余会话。

#### Scenario: One session fails during a batch run
- **GIVEN** 批次中存在多个待同步会话
- **WHEN** 某一会话同步失败
- **THEN** 系统 MUST 继续处理其他会话
- **AND** 汇总结果 MUST 反映成功/跳过/失败计数

### Requirement: Persist and Expose Sync Logs
系统 SHALL 记录同步日志，并提供查看与清空能力。

#### Scenario: User views sync logs in popup
- **WHEN** 用户点击刷新日志
- **THEN** 系统 MUST 返回按时间可读的同步日志条目

#### Scenario: User clears sync logs
- **WHEN** 用户点击清空日志
- **THEN** 系统 MUST 清空持久化日志并返回空列表

### Requirement: Provide In-Page Collector Debug Details
系统 SHALL 在采集页面暴露最近一次采集调试信息，便于排查站点选择器与会话提取问题。

#### Scenario: Collector runs on supported page
- **WHEN** 采集器完成一次会话抓取
- **THEN** 页面 MUST 可读取最近一次调试信息对象
- **AND** 控制台 MUST 输出包含站点与会话信息的调试日志
