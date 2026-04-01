# AI2Git Extension

浏览器插件（Manifest V3），支持将 ChatGPT 会话手动或自动同步到 GitHub，并生成可视化目录：

- `sync-data/raw/*`：原始 JSON
- `sync-data/timeline/*`：时间线 Markdown
- `sync-data/categorized/*`：按角色、业务主题/进展、目录分类
- `sync-data/indexes/*`：索引与导航

当前支持站点：
- `https://chat.openai.com/*`
- `https://chatgpt.com/*`
- `https://chat.deepseek.com/*`（DeepSeek）
- `https://www.qianwen.com/chat/*`（阿里千问）

## 功能

- 手动同步：选择会话 + 手动分类后发布。
- 自动同步：定时任务 + 增量游标 + 24 小时窗口去重。
- 幂等发布：内容哈希一致时跳过。
- 鉴权策略：支持 `GitHub App / OAuth / PAT`。
- 异常分级：可降级路径 `warn`，不可降级路径 `error + webhook 告警`。

## 本地使用

1. 在 Chrome 打开 `chrome://extensions`。
2. 开启“开发者模式”。
3. 选择“加载已解压的扩展程序”，目录指向当前仓库根目录（包含 `manifest.json`）。
4. 打开 ChatGPT 页面，点击插件：
   - 先“采集当前会话”
   - 配置 GitHub（owner/repo/branch/auth/token）
   - 选择会话并手动同步

## 自动同步

- 在 popup 设置启用自动同步与周期范围。
- background 会创建 alarm 定时任务。
- 每次任务会先尝试采集当前已打开的 ChatGPT 页签，再执行自动同步。

## 测试

```bash
npm test
```

## 目录结构

- `src/extension/`：background / content / popup / options
- `src/application/`：同步编排服务
- `src/domain/`：核心领域逻辑
- `src/infrastructure/`：GitHub、存储、日志告警
- `openspec/`：需求提案与规范
# ai-sync-github
