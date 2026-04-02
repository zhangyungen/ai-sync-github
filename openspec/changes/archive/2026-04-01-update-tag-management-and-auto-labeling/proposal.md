# Change: update-tag-management-and-auto-labeling

## Why
当前“角色/业务主题/目录”虽然已有配置字段，但手动同步页面并未完整联动高级设置，且自动同步对三类标签的自动贴标规则不够明确，导致配置可维护性与同步一致性不足。

## What Changes
- 明确高级设置为角色、业务主题、目录标签库的统一维护入口，支持新增、修改、去重保存。
- 手动同步支持单选与多选两种标签选择模式，并基于高级设置动态渲染可选标签。
- 自动同步增强智能贴标规则，确保输出同时具备角色、业务主题、目录三类标签。
- 修复 popup 脚本缺失问题，恢复手动同步完整交互链路。

## Impact
- Affected specs:
  - `extension-settings`
  - `session-sync`
  - `content-classification`
- Affected code:
  - `src/extension/popup/popup.js`
  - `src/domain/services/keywordAutoClassifier.js`
  - `tests/classifier.test.js`
