## ADDED Requirements
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
