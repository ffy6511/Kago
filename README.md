# Magpie Skill Workspaces

Deploy a selected set of categorized Agent Skills into each Git project from a versioned `skills.manifest.yaml`.

This is an independent Magpie page plugin with its own local host service. It installs into the official app; no Magpie fork or rebuild is needed. Tested on macOS with Magpie **0.1.3037**.

## Install locally

```sh
magpie plugin add /absolute/path/to/magpie-skill-workspaces
```

If Magpie is installed as a macOS app and its CLI is not on your PATH:

```sh
/Applications/magpie.app/Contents/MacOS/magpie plugin add /absolute/path/to/magpie-skill-workspaces
```

Open **Magpie → Plugins → Skill Workspaces** (技能工作区). Add a categorized source folder or read Magpie Library, register a Git project, select its skills and agents, then **Save manifest → Dry run → Apply**. The plugin host starts the included service automatically; you do not run a separate server.

The default loopback port is `3498`. Change it through the installed plugin's Options if needed. Options also accept `configDir` (plugin state) and `magpieDir` (Library root config); these matter for portable installations. A source-path install uses this checkout, so keep it in place and reload the plugin after code changes. Uninstall with `magpie plugin rm /absolute/path/to/magpie-skill-workspaces`; deployed files and ownership state remain unless you explicitly clean project deployments first.

## Manifest

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

`ssot` is relative to the manifest or absolute. Each skill's folder and YAML frontmatter must have the same name. An omitted `path` resolves a unique scanned name. Unknown fields, duplicate names, unsafe paths and unsupported agent IDs fail validation. An explicit empty agent list deploys nowhere.

Cursor, Codex, OpenCode and Gemini CLI share `.agents/skills`; Claude Code uses `.claude/skills`. Multiple agents sharing a destination generate one output. The manifest belongs in Git; generated outputs are excluded by the plugin's own managed `.gitignore` block.

## File safety and coexistence

- Dry run never writes project files. Apply rechecks all destinations and refuses unmanaged collisions before placing anything.
- Ownership fingerprints protect locally edited copies and replaced symlinks. A target that exactly matches the intended output is adopted and re-recorded, so an equivalent manual replacement does not stay blocked. Removed entries clean only unchanged outputs recorded by this plugin.
- Apply journals each replacement, so an interrupted operation can reconcile ownership before continuing. Cross-process locking serializes CLI and page writes. Filesystem writes assume cooperative local processes; actively hostile concurrent filesystem changes are outside this tool's guarantees.
- A symlinked `.agents/skills` parent blocks Apply. Back up and migrate the whole-directory link manually; the plugin never does that automatically.
- Relative symlinks can still point outside the workspace. Choose **copy** for restricted agents or repositories that need self-contained skill files. V1 refuses nested symlinks inside individual source skills.
- Existing Magpie Library skills can be sources, including its top-level folder links. The plugin reads Library metadata and manages project outputs in its own inventory; it does not edit `library.json` or global agent switches. Existing outputs from Magpie Projects are unmanaged collisions, not automatically adopted.

CC Switch-style global presets and market installation remain separate workflows. A plain YAML script can use this manifest, but a script must not change plugin-owned outputs behind its inventory; use the included CLI for the same ownership and cleanup behavior.

## Without the GUI

```sh
node cli.mjs --help
node cli.mjs plan /path/to/repo
node cli.mjs apply /path/to/repo
node cli.mjs sync
```

The CLI needs Node 22 or newer and installed dependencies (`bun install`). `--config-dir` isolates state; `--magpie-dir` selects the Library config root. See [CLI and recovery](docs/cli.md), [UI workflow](docs/ui.md), [integration contract](docs/integration.md), [verification](docs/verification.md), and [marketplace distribution](docs/distribution.md).

## Development

```sh
bun install --frozen-lockfile
bun run test
bun run check
bun run format:check
```

The private repository holds the source. The npm-compatible package is locally installable now; public publication and marketplace listing have not been performed. See [the spec](docs/spec.md) for scope and phase boundaries.

## 本地使用

在 Magpie 的「插件」下打开「技能工作区」，注册分类技能库与 Git 项目，选择技能及目标 agent，依次保存清单、预览同步、应用同步。全局技能开关仍由 Magpie Library 管理。

已有整目录软链会显示迁移提示，工具不会擅自替换它。默认软链适合本机共用技能库；需要项目内完整文件时选复制。取消托管会保留部署文件，CLI 的 `--clean` 才会清理未被修改的托管产物。
