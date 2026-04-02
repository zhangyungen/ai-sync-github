## ADDED Requirements

### Requirement: Index Files Must Preserve History Incrementally
系统 SHALL 对索引文件执行增量追加，不得在同步时覆盖既有历史索引记录。

#### Scenario: Sync appends index record after merging remote history
- **GIVEN** 目标仓库已存在 `indexes/index.json`
- **WHEN** 本次同步成功发布
- **THEN** 系统 MUST 先读取并合并远端索引记录
- **AND** 将本次记录追加后写回 `indexes/index.json` 与 `indexes/README.md`

#### Scenario: Local cache is stale but remote has newer records
- **GIVEN** 本地缓存索引落后于远端
- **WHEN** 执行同步发布
- **THEN** 系统 MUST 以“远端+本地去重+本次追加”结果生成索引产物

### Requirement: Markdown Rendering Must Preserve Structure for Supported Sites
系统 SHALL 为 DeepSeek 与千问同步内容保留可视化结构，包括换行、标题、列表、引用、代码块与链接。

#### Scenario: Render assistant message with headings and code blocks
- **GIVEN** 会话消息包含标题与代码块
- **WHEN** 系统生成 timeline/categorized Markdown
- **THEN** 输出 MUST 保留原有结构语义与代码块围栏格式
