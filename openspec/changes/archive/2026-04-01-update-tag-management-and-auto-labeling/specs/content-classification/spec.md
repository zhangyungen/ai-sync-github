## ADDED Requirements
### Requirement: Auto Sync Must Apply Three-Dimension Labels
系统 SHALL 在自动同步中基于会话内容智能识别并写入角色、业务主题、目录三类标签。

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
