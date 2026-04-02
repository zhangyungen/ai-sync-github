## 1. Implementation
- [x] 1.1 新增并接入 popup 脚本，基于高级设置渲染角色/业务主题/目录标签。
- [x] 1.2 手动同步支持单选与多选模式切换，并将标签选择结果提交到同步接口。
- [x] 1.3 自动分类输出补齐业务主题标签兜底，保证角色/业务主题/目录三类标签都可落盘。
- [x] 1.4 修正分类测试预期并补充自动分类兜底行为测试。

## 2. Validation
- [x] 2.1 执行 `npm test` 并通过。
- [x] 2.2 执行 `openspec validate update-tag-management-and-auto-labeling --strict` 并通过。
