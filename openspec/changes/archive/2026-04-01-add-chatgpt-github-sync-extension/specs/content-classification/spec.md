## ADDED Requirements

### Requirement: Require Manual Classification Before Batch Publish
系统 SHALL 在每批次同步前展示会话标题与内容标签，并允许用户手动确认分类后再发布。

#### Scenario: User confirms classification before publishing
- **GIVEN** 用户发起手动同步批次
- **WHEN** 系统展示会话标题与可选标签（角色、业务、目录）
- **THEN** 用户确认后系统才允许执行发布

### Requirement: Keep Raw Copy and Classified Copy
系统 SHALL 同时保留原始会话副本与分类后副本，且两者可相互追溯。

#### Scenario: Batch sync completes successfully
- **GIVEN** 一个同步批次成功完成
- **WHEN** 用户查看同步结果
- **THEN** 可以同时看到 raw 副本与 categorized 副本，并可定位到同一来源会话

### Requirement: Support Role-Based and Dynamic Business Progress Tags
系统 SHALL 支持按角色与业务主题对输出内容分类，其中角色标签至少支持：资深市场需求分析师、资深业务架构师、资深产品设计师（需求设计）、资深技术架构师；业务主题/进展标签不采用固定枚举。

#### Scenario: User assigns multiple tags to a session
- **GIVEN** 用户正在对会话进行分类
- **WHEN** 用户同时选择角色标签和业务主题/进展标签
- **THEN** 系统按多标签规则生成分类输出路径与索引

#### Scenario: User enters a non-enum business progress tag
- **GIVEN** 用户输入了未预置的业务主题或进展标签
- **WHEN** 用户提交分类确认
- **THEN** 系统接受该标签并完成分类发布

### Requirement: Keep Auto Classification Optional and Fallback to Manual
系统 SHALL 将自动分类实现为可选能力；当准确率不足、服务不可用或低置信度时，必须回退到手动分类确认。

#### Scenario: Auto classifier returns low confidence
- **GIVEN** 自动分类已启用且返回低于阈值的结果
- **WHEN** 同步进入分类确认步骤
- **THEN** 系统忽略自动结果并要求用户手动确认分类
