# Change: update-multisite-sync-index-and-observability

## Why
近期实现已扩展到 DeepSeek/千问多站点同步，并补齐索引历史增量、同步日志可观测性、配置导入导出与手动标签交互优化，但 OpenSpec 文档尚未完整覆盖，导致实现与规范存在偏差。

## What Changes
- 补充多站点会话采集与失败重试注入行为规范（ChatGPT/DeepSeek/千问）。
- 补充自动同步增量判断的消息签名规则，覆盖“消息 ID 不变但内容更新”场景。
- 补充索引文件（`indexes/README.md`、`indexes/index.json`）远端合并后增量追加规范，避免覆盖历史。
- 补充同步日志记录与查看/清空能力规范。
- 补充高级设置配置文件导入/导出规范。
- 补充手动标签交互规则：固定多选、可空选、标签横向颗粒化展示。
- 补充自动同步周期约束（默认 2 分钟，最小 1 分钟，最大 5 分钟）与状态显著展示规范。

## Impact
- Affected specs:
  - `session-sync`
  - `github-visualization-output`
  - `extension-settings`
  - `content-classification`
- Affected code:
  - `src/extension/content/collector.js`
  - `src/extension/background/background.js`
  - `src/extension/popup/*`
  - `src/extension/options/*`
  - `src/application/syncPipeline.js`
  - `src/infrastructure/storage/stateRepository.js`
  - `src/infrastructure/github/client.js`
  - `src/infrastructure/github/publisher.js`
  - `src/constants/sync.js`
