<div align="center">
<a name="readme-top"></a>

# Magpie Skill Workspaces

One manifest as the single source of truth — one action deploys exactly the Agent Skills each project needs.

**English** · [简体中文](README-zh.md)

<br/>

<a href="https://github.com/ffy6511/magpie-skill-workspaces/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/ffy6511/magpie-skill-workspaces?style=for-the-badge&logo=github&color=E3B341&labelColor=20242D"></a>
<a href="https://github.com/ffy6511/magpie-skill-workspaces/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/ffy6511/magpie-skill-workspaces?style=for-the-badge&logo=git&color=1B54E8&labelColor=20242D"></a>
<a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/ffy6511/magpie-skill-workspaces?style=for-the-badge&logo=opensourceinitiative&logoColor=white&color=34D399&labelColor=20242D"></a>
<a href="https://nodejs.org"><img alt="Node.js 22 or newer" src="https://img.shields.io/badge/node-%3E%3D22-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white&labelColor=20242D"></a>
<a href="docs/integration.md"><img alt="Tested with Magpie 0.1.3037" src="https://img.shields.io/badge/Magpie-0.1.3037-8B5CF6?style=for-the-badge&labelColor=20242D"></a>

</div>

<details>
<summary><kbd>Table of contents</kbd></summary>

- [Features](#features)
- [Install](#install)
- [Manifest](#manifest)
- [File safety](#file-safety)
- [CLI](#cli)
- [Development](#development)
- [Docs](#docs)
- [License](#license)

<br/>

</details>

<a name="features"></a>

## Features

- **Single source of truth** — one `skills.manifest.yaml` per repository defines the sources, agents and deployment method.
- **Per-project precision** — every project gets exactly the skills it needs; shared agent directories are deduplicated automatically.
- **Link or copy** — relative links by default; copy for restricted agents or repositories that need self-contained files.
- **Ownership safeguards** — fingerprints protect deployed outputs, an exact replacement is adopted, and local edits block cleanup.
- **Linked-folder repair** — replace a whole-folder `.agents/skills` symlink with a real folder after an explicit confirmation.
- **GUI and CLI, one engine** — preview in Magpie, automate from the CLI; the same planner, locking and recovery logic.

<a name="install"></a>

## Install

```sh
magpie plugin add /absolute/path/to/magpie-skill-workspaces
```

If the macOS app's CLI is not on `PATH`:

```sh
/Applications/magpie.app/Contents/MacOS/magpie plugin add /absolute/path/to/magpie-skill-workspaces
```

Open **Magpie → Plugins → Skill Workspaces**, register a source and a Git project, choose skills, then **Preview → Sync** as needed. Sync validates the current draft, writes `skills.manifest.yaml` atomically and deploys it. No separate server is needed; the page is served on loopback port `3498` (configurable in the plugin options).

A source-path install uses this checkout, so reload the plugin after code changes. Remove it with `magpie plugin rm /absolute/path/to/magpie-skill-workspaces`.

<a name="manifest"></a>

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

<a name="file-safety"></a>

## File safety

- Preview never writes project files. Sync rechecks every destination, refuses unmanaged collisions and only writes the manifest after planning succeeds.
- Ownership fingerprints protect deployed outputs; an exact replacement is adopted, while local edits block cleanup.
- Each replacement is journaled, and cross-process locking serializes CLI and page writes. Writes assume cooperative local processes.
- A symlinked `.agents/skills` blocks sync. The page can replace that link with a real folder after a confirmation that names the target; the target itself is never touched. Higher-level links stay manual.
- Relative links can point outside the repository; choose **copy** for restricted agents. Nested symlinks inside a source skill are refused.
- Magpie Library skills can be sources, including its top-level folder links. `library.json` and global agent switches are never edited; existing Magpie Projects outputs are unmanaged collisions.

<a name="cli"></a>

## CLI

```sh
node cli.mjs plan /path/to/repo
node cli.mjs apply /path/to/repo
node cli.mjs sync
```

Node 22 or newer, with dependencies installed (`bun install`). `--config-dir` isolates state; `--magpie-dir` selects the Library config root.

<a name="development"></a>

## Development

```sh
bun install --frozen-lockfile
bun run test
bun run check
bun run format:check
```

<a name="docs"></a>

## Docs

| Document                                         | Contents                                          |
| ------------------------------------------------ | ------------------------------------------------- |
| [CLI and recovery](docs/cli.md)                  | Commands, ownership, interrupted work             |
| [UI workflow](docs/ui.md)                        | Page controls, conflict repair, source editing    |
| [Integration contract](docs/integration.md)      | Magpie host, local service and package boundaries |
| [Verification](docs/verification.md)             | Historical acceptance record                      |
| [Marketplace distribution](docs/distribution.md) | Packaging and distribution boundaries             |
| [Spec](docs/spec.md)                             | Scope, behavior contracts and acceptance          |

<a name="license"></a>

## License

[MIT](LICENSE)

<div align="right">

[Back to top ↑](#readme-top)

</div>
