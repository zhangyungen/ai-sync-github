## ADDED Requirements

### Requirement: Output Must Be GitHub-Visualizable
系统 SHALL 将同步结果输出为 GitHub 可直接浏览的格式（Markdown 与结构化 JSON），不依赖本地专用工具即可查看。

#### Scenario: User opens repository in GitHub web UI
- **GIVEN** 同步任务已完成并提交到目标仓库
- **WHEN** 用户在 GitHub 网页查看同步目录
- **THEN** 用户可以通过 Markdown 页面和链接直接浏览会话内容与导航结构

### Requirement: Provide Timeline and Session Navigation
系统 SHALL 生成按时间线与会话组织的导航索引，支持从总览跳转到单会话详情。

#### Scenario: User navigates from index to session detail
- **GIVEN** 仓库中已存在索引页
- **WHEN** 用户从总览页点击某条会话记录
- **THEN** 可以跳转到对应会话详情并查看完整上下文

### Requirement: Ensure Idempotent Publication
系统 SHALL 使用稳定路径规则与内容哈希避免重复发布相同内容。

#### Scenario: No new content since last sync
- **GIVEN** 某会话自上次同步后没有新增消息
- **WHEN** 自动同步任务再次执行
- **THEN** 系统不应生成重复文件或无意义提交

### Requirement: Protect Secrets and Credentials
系统 SHALL 将 GitHub 凭据等敏感信息存放在安全配置中，不得写入仓库内容与普通日志。

#### Scenario: Sync pipeline writes logs and artifacts
- **GIVEN** 同步任务执行中发生正常日志记录
- **WHEN** 系统输出日志并写入仓库文件
- **THEN** 任意输出中都不包含明文凭据或敏感 token

### Requirement: Support Multiple GitHub Authentication Modes
系统 SHALL 支持 GitHub App、OAuth、PAT 三种鉴权模式，并允许用户按仓库配置选择其一。

#### Scenario: User chooses OAuth mode for publishing
- **GIVEN** 用户已在插件设置中完成 OAuth 授权
- **WHEN** 系统执行同步发布
- **THEN** 系统使用 OAuth 凭据完成 GitHub 写入

### Requirement: Do Not Require PR Workflow for Sync Publish
系统 SHALL 支持直接发布到用户指定目标分支，不强制要求专用分支与 PR 流程。

#### Scenario: User publishes to target branch directly
- **GIVEN** 用户已配置目标分支
- **WHEN** 同步任务发布变更
- **THEN** 系统可直接提交到目标分支且不要求创建 PR
