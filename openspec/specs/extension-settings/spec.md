# extension-settings Specification

## Purpose
TBD - created by archiving change update-advanced-settings-proxy. Update Purpose after archive.
## Requirements
### Requirement: Centralized Advanced Settings
The extension SHALL use the advanced settings page as the single entry to manage GitHub, auto-sync, and proxy configuration.

#### Scenario: User updates sync configuration from advanced settings
- **WHEN** the user opens the advanced settings page
- **THEN** the page MUST display editable fields for GitHub owner/repo/branch/auth/token, auto-sync interval settings, and proxy server/port
- **AND** saving the form MUST persist these values into runtime config

#### Scenario: Popup focuses on execution actions
- **WHEN** the user opens the popup page
- **THEN** the popup MUST provide session collection and sync execution actions
- **AND** the popup MUST not require editing GitHub or auto-sync settings directly

### Requirement: Proxy Application for Runtime Network Access
The extension SHALL support applying a configurable proxy for runtime network requests.

#### Scenario: Enable proxy with valid server and port
- **WHEN** proxy server and proxy port are both configured and saved
- **THEN** background runtime MUST apply fixed proxy settings via browser proxy API
- **AND** subsequent runtime sync traffic MUST use the configured proxy route

#### Scenario: Disable proxy
- **WHEN** proxy server and proxy port are cleared
- **THEN** background runtime MUST clear previously applied proxy settings

### Requirement: Extension Branding Name
The extension SHALL expose the product name as `AI2Git` in extension metadata and user-facing title.

#### Scenario: Display extension name
- **WHEN** the extension is loaded in browser
- **THEN** extension metadata name and default action title MUST be `AI2Git`

### Requirement: Maintain Classification Tag Libraries in Advanced Settings
系统 SHALL 在高级设置中提供角色、业务主题、目录标签库的统一维护能力，并将其作为手动/自动同步的配置来源。

#### Scenario: User edits classification tag libraries
- **WHEN** 用户在高级设置页新增、修改或删除角色/业务主题/目录标签并保存
- **THEN** 系统 MUST 对标签做去重与空值过滤后持久化
- **AND** popup 手动同步界面 MUST 使用最新标签库进行展示

### Requirement: Configure Manual Selection Mode in Advanced Settings
系统 SHALL 支持在高级设置中配置手动同步标签选择模式（单选或多选）。

#### Scenario: User switches manual selection mode
- **WHEN** 用户将手动模式设置为单选或多选并保存
- **THEN** popup 手动同步界面 MUST 按配置切换标签控件行为

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

