## ADDED Requirements

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
