# Change: update-advanced-settings-proxy

## Why
当前插件在 popup 与 options 两处维护配置，且 GitHub 访问在网络受限环境下缺少代理能力，导致配置混乱与同步失败率上升。

## What Changes
- 将 GitHub 配置统一放入高级设置页面维护。
- 将自动同步配置统一放入高级设置页面维护。
- 新增代理服务器与代理端口配置，并在后台运行时应用到浏览器代理设置。
- popup 页面仅保留会话采集与同步操作，配置入口统一跳转高级设置。
- 插件名称统一更新为 `AI2Git`。

## Impact
- Affected specs:
  - `extension-settings`
- Affected code:
  - `manifest.json`
  - `src/constants/sync.js`
  - `src/extension/options/*`
  - `src/extension/popup/*`
  - `src/extension/background/background.js`
