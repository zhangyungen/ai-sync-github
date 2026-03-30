# Project Context

## Purpose
构建一个浏览器插件，支持手动与自动同步 ChatGPT 聊天记录到 GitHub，确保同步产物可在 GitHub Web 中直接可视化浏览，并保留原始数据与分类数据双轨输出。

## Tech Stack
- JavaScript (ES Modules)
- Chrome Extension Manifest V3
- GitHub REST API (contents upsert)
- Node.js 内置测试框架（`node --test`）

## Project Conventions

### Code Style
- 使用小函数、单一职责、显式错误处理。
- 常量、错误码集中在 `src/constants/`，避免魔法值。
- 关键业务通过对象参数传递，减少参数数量膨胀。
- 日志必须脱敏，不输出 token/secret。

### Architecture Patterns
- 分层架构：
  - `extension`：UI 和浏览器运行时入口（popup/options/background/content）
  - `application`：同步编排服务（手动/自动）
  - `domain`：标准化、分类、渲染、策略（去重、周期校验）
  - `infrastructure`：GitHub 客户端、存储仓储、日志告警
- 同步流水线：`Collector -> Normalizer -> Classifier -> Renderer -> Publisher`
- 分类策略：手动优先，自动分类可选并低置信度回退手动确认。

### Testing Strategy
- 单元测试覆盖核心领域逻辑：标准化、分类、去重、周期策略、渲染。
- 集成测试覆盖同步主链路（内存存储 + mock publisher）。
- 本地统一运行：`npm test`。

### Git Workflow
- OpenSpec 驱动：先 proposal，再 apply，再 archive。
- 变更以小步迭代提交，避免大批量不可审查变更。

## Domain Context
- 会话数据需要同时满足追溯（raw）和消费（categorized/timeline）场景。
- 角色标签为固定域值；业务主题/进展标签为动态文本标签。
- 自动同步需满足增量游标、24 小时去重、幂等发布。

## Important Constraints
- GitHub 鉴权模式必须同时支持 `App / OAuth / PAT`。
- 自动同步周期必须可配置且受最小/最大范围限制。
- 不强制 PR 流程，默认直推目标分支。
- 不得在仓库文件或普通日志中泄露凭据。

## External Dependencies
- ChatGPT Web 页面 DOM（用于会话采集）
- GitHub REST API（`/repos/{owner}/{repo}/contents/{path}`）
- 可选告警 Webhook（不可降级错误上报）
