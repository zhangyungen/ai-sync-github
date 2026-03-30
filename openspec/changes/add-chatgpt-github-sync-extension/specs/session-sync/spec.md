## ADDED Requirements

### Requirement: Support Manual Session Sync
系统 SHALL 提供手动同步能力，允许用户显式选择要同步的聊天会话与目标分类目录后再执行同步。

#### Scenario: User selects sessions and category for one-time sync
- **GIVEN** 用户已完成插件与 GitHub 目标仓库的基础配置
- **WHEN** 用户在手动同步界面选择一个或多个会话并确认分类目录
- **THEN** 系统执行同步并将结果写入对应目录

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

### Requirement: Handle Sync Failures with Degradation Rules
系统 SHALL 对同步异常进行分级处理：可降级异常记录 warn 并继续流程；不可降级异常记录 error 并触发告警。

#### Scenario: Auto-classification fails during sync
- **GIVEN** 自动分类模块临时不可用
- **WHEN** 同步任务执行到分类阶段失败
- **THEN** 系统记录 warn，回退手动分类路径，不中断本次可继续流程

#### Scenario: Publishing fails after retries
- **GIVEN** GitHub 发布接口连续重试后仍失败
- **WHEN** 系统判定该错误无法降级
- **THEN** 系统记录 error 并触发告警
