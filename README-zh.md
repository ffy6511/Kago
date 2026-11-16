<div align="center">
<a name="readme-top"></a>

<img src="page/kago-icon.png" alt="Kago 篮子图标" width="160" height="160">

# Kago

为每个项目配好 Agent Skills。

Kago 是一个 Magpie 插件，从共享来源挑选技能，用一份纳入 Git 的清单部署每个项目需要的一套。

[English](README.md) · **简体中文**

<br/>

<a href="https://github.com/ffy6511/magpie-skill-workspaces/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/ffy6511/magpie-skill-workspaces?style=for-the-badge&logo=github&color=E3B341&labelColor=20242D"></a>
<a href="https://github.com/ffy6511/magpie-skill-workspaces/commits/main"><img alt="最近提交" src="https://img.shields.io/github/last-commit/ffy6511/magpie-skill-workspaces?style=for-the-badge&logo=git&color=1B54E8&labelColor=20242D"></a>
<a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/github/license/ffy6511/magpie-skill-workspaces?style=for-the-badge&logo=opensourceinitiative&logoColor=white&color=34D399&labelColor=20242D"></a>
<a href="https://nodejs.org"><img alt="Node.js 22 或更新版本" src="https://img.shields.io/badge/node-%3E%3D22-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white&labelColor=20242D"></a>
<a href="docs/integration.md"><img alt="已在 Magpie 0.1.3037 上验证" src="https://img.shields.io/badge/Magpie-0.1.3037-8B5CF6?style=for-the-badge&labelColor=20242D"></a>

</div>

<details>
<summary><kbd>目录</kbd></summary>

- [特性](#features)
- [安装](#install)
- [清单](#manifest)
- [文件安全](#file-safety)
- [CLI](#cli)
- [开发](#development)
- [文档](#docs)
- [许可证](#license)

<br/>

</details>

<a name="features"></a>

## 特性

- **唯一真源**：每个仓库一份 `skills.manifest.yaml`，定义来源、agent 和部署方式。
- **按项目精细部署**：每个项目只拿它需要的技能；共享 agent 目录自动去重。
- **软链或复制**：默认相对软链；受限 agent 或需要自包含文件的仓库可以选择复制。
- **所有权保护**：指纹保护部署产物；完全一致的替换自动接管；本地修改会阻止清理。
- **整目录软链修复**：明确确认后，把 `.agents/skills` 整目录链接替换为真实目录。
- **页面与 CLI 共用引擎**：在 Magpie 里预览，在 CLI 里自动化；同一套计划、加锁和恢复逻辑。

<a name="install"></a>

## 安装

```sh
magpie plugin add /absolute/path/to/magpie-skill-workspaces
```

如果 macOS 应用的 CLI 不在 `PATH` 里：

```sh
/Applications/magpie.app/Contents/MacOS/magpie plugin add /absolute/path/to/magpie-skill-workspaces
```

打开 **Magpie → 插件 → Kago**，注册技能来源和 Git 项目，选择技能后按需执行 **预览 → 同步**。同步会校验当前草稿，原子写入 `skills.manifest.yaml` 并部署。不需要单独起服务；页面通过 loopback 端口 `3498` 提供，可在插件 Options 里修改。

以源码路径安装时使用的是当前 checkout，改完代码后重新加载插件即可。卸载使用 `magpie plugin rm /absolute/path/to/magpie-skill-workspaces`。

<a name="manifest"></a>

## 清单

```yaml
version: 1
ssot: ../skills/obsidian-friendily-workflow/skills
defaults:
  agents: [cursor, codex]
deploy:
  method: link
skills:
  - name: obsidian-markdown
    path: obsidian/obsidian-markdown
  - name: paper-md-ingest
    path: obsidian/paper-md-ingest
    agents: [claude]
```

`ssot` 相对于清单文件，或使用绝对路径。技能目录名必须与 YAML frontmatter 里的 `name` 一致。省略 `path` 时会解析唯一扫描到的同名技能。未知字段、重复名称、不安全路径和不支持的 agent ID 都会让校验失败。显式写空的 agent 列表表示不部署到任何地方。

Cursor、Codex、OpenCode、Gemini CLI 共用 `.agents/skills`，Claude Code 使用 `.claude/skills`。多个 agent 指向同一目录时只生成一份产物。清单应当提交到 Git；生成的产物由插件自己的 `.gitignore` 托管块排除。

<a name="file-safety"></a>

## 文件安全

- 预览不写项目文件。同步会重新检查每个目标，拒绝未托管冲突，并在规划成功后写入清单。
- 所有权指纹保护部署产物；完全一致的替换自动接管，本地修改会阻止清理。
- 每次替换都会记入日志，跨进程锁串行化 CLI 和页面的写入。写入假设本机进程是协作式的。
- `.agents/skills` 是软链时会阻止同步。页面可以在确认后把链接替换为真实目录，确认框会显示目标；链接目标本身不受影响。更高层的链接仍需手工处理。
- 相对软链可能指向仓库外；受限 agent 请选 **复制**。技能源内部的嵌套软链会被拒绝。
- Magpie Library 技能可以作为来源，包括顶层目录链接。插件不会修改 `library.json` 或全局 agent 开关；Magpie Projects 已生成的产物属于未托管冲突。

<a name="cli"></a>

## CLI

```sh
node cli.mjs plan /path/to/repo
node cli.mjs apply /path/to/repo
node cli.mjs sync
```

需要 Node 22 或更新版本，并已安装依赖（`bun install`）。安装后的命令名为 `kago`。`--config-dir` 隔离状态；`--magpie-dir` 选择 Library 配置根目录。

<a name="development"></a>

## 开发

```sh
bun install --frozen-lockfile
bun run test
bun run check
bun run format:check
```

<a name="docs"></a>

## 文档

| 文档                             | 内容                           |
| -------------------------------- | ------------------------------ |
| [CLI 与恢复](docs/cli.md)        | 命令、所有权、中断后的处理     |
| [界面流程](docs/ui.md)           | 页面控件、冲突修复、源文件编辑 |
| [集成契约](docs/integration.md)  | Magpie host、本地服务与包边界  |
| [验证记录](docs/verification.md) | 历史验收记录                   |
| [市场分发](docs/distribution.md) | 打包与分发边界                 |
| [规格](docs/spec.md)             | 范围、行为契约与验收           |

<a name="license"></a>

## 许可证

[MIT](LICENSE)

<div align="right">

[返回顶部 ↑](#readme-top)

</div>
