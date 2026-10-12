# 更新记录

版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)：`主.次.补丁`。  
日常开发随便提交；过一段时间功能稳定后，再升版本、写本文件、打 `vX.Y.Z` 标签并推到 Gitee / GitHub。

## 发版步骤（简）

1. 改 `package.json` 的 `"version"`
2. 在本文件顶部追加一节说明
3. `git commit` → `git tag -a vX.Y.Z -m "..."` → 推送代码与 tag（两边仓库）

---

## [1.1.0] — 2026-10-12

首个对外可分享的正式版（本机优先观鸟笔记本）。

### 包含

- 鸟种名录、观察记录、地点、个人统计 / 目标 / 加新预测
- 个人数据与程序分离（`KBird-Data`）；探索调查项目运行时从个人目录读取
- Windows 一键安装 / 启停；公开文字种子名录；非商业 LICENSE
- Gitee + GitHub 双远程同步
