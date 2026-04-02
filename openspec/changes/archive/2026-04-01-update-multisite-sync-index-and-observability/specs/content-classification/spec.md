## ADDED Requirements

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
