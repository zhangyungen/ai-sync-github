## ADDED Requirements
### Requirement: Support Single and Multiple Selection in Manual Sync
系统 SHALL 在手动同步中同时支持标签单选和多选，并允许用户批量选择会话执行同步。

#### Scenario: Manual sync in multiple mode
- **GIVEN** 手动同步模式为多选
- **WHEN** 用户选择多个会话并为角色、业务主题、目录选择多个标签
- **THEN** 系统按多标签结果执行同步

#### Scenario: Manual sync in single mode
- **GIVEN** 手动同步模式为单选
- **WHEN** 用户在某一标签维度重复选择
- **THEN** 系统仅保留该维度的最后一个选择并用于同步
