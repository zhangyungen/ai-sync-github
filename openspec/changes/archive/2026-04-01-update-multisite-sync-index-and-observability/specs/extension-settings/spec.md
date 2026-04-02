## ADDED Requirements

### Requirement: Manual Tag Selection Must Be Fixed Multi-Select and Optional
系统 SHALL 将手动同步标签选择模式固定为多选，并允许角色标签、业务主题标签、目录标签为空选择。

#### Scenario: User submits manual sync with partial or empty tag selection
- **GIVEN** 用户已选择至少一个会话
- **WHEN** 用户未选择任一标签或仅选择部分标签
- **THEN** 系统 MUST 允许提交手动同步请求
- **AND** 标签字段按用户实际选择结果写入（可为空数组）

### Requirement: Popup Must Emphasize Auto Sync Status and Horizontal Tag Chips
系统 SHALL 在功能面板显著展示自动同步状态，并以横向颗粒化样式展示标签选项。

#### Scenario: Auto sync enabled status is displayed in popup
- **GIVEN** 自动同步已启用
- **WHEN** 用户打开 popup
- **THEN** popup MUST 显示“已启用”状态与当前周期及范围信息

#### Scenario: Tag options are rendered as horizontal chips
- **GIVEN** 标签库已在高级设置维护
- **WHEN** popup 渲染角色/业务主题/目录标签
- **THEN** 标签选项 MUST 采用横向换行的颗粒化 chip 样式展示
- **AND** popup 不显示“分类”字样标题

### Requirement: Advanced Settings Must Support Config Import and Export
系统 SHALL 在高级设置中支持配置文件导入与导出。

#### Scenario: Export current configuration
- **WHEN** 用户在高级设置点击导出配置
- **THEN** 系统 MUST 以 JSON 文件下载当前配置快照

#### Scenario: Import configuration file
- **WHEN** 用户导入合法 JSON 配置文件
- **THEN** 系统 MUST 应用并保存配置
- **AND** 表单展示值 MUST 与导入结果保持一致

### Requirement: Auto Sync Interval Defaults and Bounds
系统 SHALL 将自动同步默认周期设置为 2 分钟，最小周期 1 分钟，最大周期 5 分钟。

#### Scenario: Persist auto-sync interval settings
- **WHEN** 用户保存自动同步周期配置
- **THEN** 系统 MUST 校验并保存最小/最大/当前周期
- **AND** 默认值分别为 1、5、2（分钟）
