# Git 提交与上游协作

本文约定 ReinaManager fork 的提交粒度、提交标题和上游同步流程，供开发者及 AI Agent 共同遵守。

## 按功能拆分提交

- 一个提交只包含一个可独立审查、验证和合并的功能或修复。
- 每项功能完成并通过对应检查后，立即创建该功能的提交，再同步上游；不要等多个功能全部完成后一次性提交。
- 不要提交无关格式化、个人配置或用户原有的工作区改动。提交前用 `git status` 和 `git diff --cached` 核对暂存内容。
- 同一文件混有多个功能时，使用 `git add -p <file>` 按代码块暂存。若一个代码块同时包含不同功能，尝试输入 `s` 拆分；提交前检查 `git diff --cached`。

## 提交标题格式

使用英文 Conventional Commits 格式：

```text
type(scope): summary
```

标题的 `type`、`scope` 和 `summary` 都使用英文。summary 简短、小写、以动词开头，不加句号。

推荐类型：

| Type | 用途 |
| --- | --- |
| `feat` | 新增用户可见功能 |
| `fix` | 修复缺陷 |
| `refactor` | 重构，不改变外部行为 |
| `perf` | 性能优化 |
| `docs` | 文档变更 |
| `test` | 测试变更 |
| `build` | 构建、依赖或工具链变更 |
| `ci` | CI 工作流变更 |
| `chore` | 其他维护工作 |

scope 使用简短的英文模块名，例如 `settings`、`theme`、`backup`、`import`、`titlebar`、`docs`。一个标题只选一个最主要的 scope。

示例：

```text
feat(settings): add theme color presets
feat(import): configure launcher candidate rules
feat(backup): upload automatic backups to webdav
fix(titlebar): restore window controls after restart
docs(git): document upstream contribution workflow
```

## 每项功能完成后同步上游

先确保当前功能改动已提交，并且工作区中其他未提交内容不会被一起带入。然后在当前功能分支执行：

```bash
git fetch upstream
git merge upstream/main
```

若出现冲突，解决后检查合并结果并运行相关检查。上游新增提交如已包含当前功能，先确认重复内容，再选择合并或重放提交，避免重复提交同一改动。

## 将单项功能提交给上游

先确认功能已经独立提交在 fork 分支上，再推送到 fork：

```bash
git push -u origin <feature-branch>
```

随后在 GitHub 创建 Pull Request，目标仓库选择上游 `huoshen80/ReinaManager`，目标分支选择 `main`。PR 只应包含该功能相关的提交。

如果功能提交和其他工作共用文件，提交时通过 `git add -p` 只选择该功能的代码块，并在创建 PR 前检查分支相对 `upstream/main` 的提交列表和差异。
