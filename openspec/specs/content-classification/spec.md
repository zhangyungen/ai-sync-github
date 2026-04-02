# content-classification Specification

## Purpose
定义会话分类的输入规则、自动分类策略与回退行为，确保手动与自动同步都能稳定产生可发布的三维标签结果。

## Requirements
### Requirement: Require Manual Classification Input for Manual Sync
系统 SHALL 在手动同步前允许用户为会话输入分类标签，并以用户输入作为手动同步的直接分类来源。

#### Scenario: User confirms classification before manual publishing
- **GIVEN** 用户发起手动同步批次
- **WHEN** 用户在界面中选择角色、业务主题、目录标签并提交
- **THEN** 系统 MUST 使用该输入执行分类并发布

### Requirement: Keep Raw Copy and Classified Copy
系统 SHALL 同时保留原始会话副本与分类后副本，且两者可相互追溯。

#### Scenario: Batch sync completes successfully
- **GIVEN** 一个同步批次成功完成
- **WHEN** 用户查看同步结果
- **THEN** 可以同时看到 raw 副本与 categorized 副本，并可定位到同一来源会话

### Requirement: Support Role-Based and Dynamic Business Tags
系统 SHALL 支持按角色与业务主题对输出内容分类；角色标签库、业务主题标签库和目录标签库应来自可配置项并支持动态调整。

#### Scenario: User assigns multiple tags to a session
- **GIVEN** 用户正在对会话进行分类
- **WHEN** 用户同时选择角色标签和业务主题标签
- **THEN** 系统按多标签规则生成分类输出路径与索引

#### Scenario: User uses a newly maintained business tag
- **GIVEN** 用户在高级设置中维护了新的业务主题标签
- **WHEN** 用户在手动同步中选择该标签
- **THEN** 系统 MUST 接受该标签并完成分类发布

### Requirement: Auto Classification Must Be Optional and Mode-Aware
系统 SHALL 将自动分类实现为可选能力，并按同步模式应用不同回退策略。

#### Scenario: Auto sync applies fallback classification on low confidence
- **GIVEN** 自动分类已启用且自动同步触发
- **WHEN** 自动分类置信度低于阈值
- **THEN** 系统 MUST 仍输出可发布分类结果并继续自动同步

#### Scenario: Manual sync always prefers manual input
- **GIVEN** 用户发起手动同步
- **WHEN** 系统执行分类决策
- **THEN** 系统 MUST 优先使用用户当前提交的手动标签输入

### Requirement: Auto Sync Must Apply Three-Dimension Labels
系统 SHALL 在自动同步中输出角色、业务主题、目录三类标签。

#### Scenario: Auto sync labels a technical conversation
- **GIVEN** 自动同步已启用自动分类
- **WHEN** 系统识别到会话内容偏技术架构主题
- **THEN** 输出结果 MUST 包含角色标签
- **AND** 输出结果 MUST 包含业务主题标签
- **AND** 输出结果 MUST 包含目录标签

#### Scenario: No explicit business keyword is detected
- **GIVEN** 自动分类未命中明确业务主题关键词
- **WHEN** 系统生成分类结果
- **THEN** 系统 MUST 仍输出一个可用业务主题标签作为兜底

### Requirement: Manual Classification Tags May Be Empty by Dimension
系统 SHALL 允许角色、业务主题、目录三个维度独立为空，不强制每个维度至少选择一个标签。

#### Scenario: User selects only business tags
- **GIVEN** 用户执行手动同步
- **WHEN** 仅选择业务主题标签且角色/目录为空
- **THEN** 系统 MUST 接受该分类输入并继续同步

#### Scenario: User selects no tags in all dimensions
- **GIVEN** 用户执行手动同步且已选中会话
- **WHEN** 三个标签维度均为空
- **THEN** 系统 MUST 接受空标签输入并继续同步
