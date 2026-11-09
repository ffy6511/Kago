# Spec: Magpie Skill Workspaces — distributable plugin

Status: MVP implemented and locally installed · Revised: 2026-11-05

## 1. Product and delivery contract

Build an independently installable Magpie community plugin, not a Magpie fork or a built-in Go module. Keep the plugin source in the user's private GitHub repository `magpie-skill-workspaces`, checked out at `/Users/zhuo/Developer/tools/magpie-skill-workspaces`.

The deliverable is one npm-compatible package containing the page, host service, sync engine, CLI and documentation. It must install from a local directory with `magpie plugin add /absolute/path/to/package`. Publishing to npm or submitting a community registry entry is a separate, later release action, not authorized by this implementation task. Local installation must not require publishing the private source repository.

## 2. User need

Maintain reusable Agent Skills in categorized SSOT folders (for example `obsidian/`, `blog/`, `dev/`, `writing/`). Each Git project selects a subset in a versioned `skills.manifest.yaml`, chooses target agents, and can preview and apply deployment repeatedly. Source folders remain in place. Existing Magpie Library skills are also valid sources.

Project-level deployment is distinct from global agent installation. The plugin must make that distinction visible and must not change global agent skill switches.

## 3. Architecture and feasibility gate

Use the established community page + host-part pattern, as demonstrated by `magpie-community/plugins/packages/chat`:

- `package.json` declares `magpie.page`, a page service, options, and an ESM `main`.
- The launcher is hosted in Magpie's sandbox, reads theme/options via `_magpie/bridge.js`, and navigates its frame to the local plugin service.
- The package exports an OpenCode v1 `{ id, server }` host module. Magpie's Bun plugin host starts a service bound only to `127.0.0.1`.
- The service serves the actual UI and APIs and performs file operations. Guard APIs with a per-process random token, strict Host checks, bounded request bodies and no permissive CORS. Escape displayed data.
- Do not assume that a sandbox page can fetch `/api/library`, or that the host's GUI HTTP API is publicly authenticated for third-party writes.
- Inspect current Magpie source/CLI for supported Library integration. Prefer the official CLI for mutations if available. Otherwise read Library metadata/folders as sources and manage plugin-owned project deployments separately. Never directly rewrite `library.json` behind Magpie's back. Document the exact integration boundary.

Before product implementation, prove the installed Magpie version can install the local package, load its page host and read a temporary source. Current local baseline: Magpie 0.1.3037. Record the tested version; do not infer the minimum supported release without evidence.

## 4. MVP behavior

1. Register multiple source roots locally; recursively index folders containing `SKILL.md`, preserving category and leaf-folder name. Detect duplicate names and invalid frontmatter rather than choosing silently.
2. Register Git project roots and a configurable manifest path (default `<root>/skills.manifest.yaml`). Re-registering a project without a new path keeps its current one. Allow existing Magpie Library project/source discovery where supported, without claiming shared ownership of its deployments.
3. Read and write version-1 manifests; selecting sources and skills in the UI can create a manifest. Preview YAML and open its containing folder.
4. Dry run computes create/update/remove/unchanged/conflict operations without writing project files or importing sources. Apply validates the full plan before mutations, maintains an ownership inventory, removes only unchanged plugin-owned outputs and refuses unmanaged collisions.
5. Deploy `link` (default, relative symlinks where possible) or `copy` per project. Relative symlinks do not make out-of-workspace sources available to restricted cloud agents; use copy for that case.
6. Support per-skill agent overrides and project defaults. Derive agent path mappings from the verified Magpie contract, including shared-directory deduplication. At least Cursor, Codex, OpenCode, Gemini CLI and Claude Code; do not assume every agent uses `.agents/skills` if upstream differs.
7. Detect missing/wrong/stale/locally modified deployments. Sync one project or all registered projects. A bad project must not stop reporting the other projects.
8. Removing a project with keep enabled preserves deployed files and relinquishes plugin ownership. Never delete user-owned files.
9. Provide a no-GUI CLI using the same manifest and engine (`scan`, `plan`, `apply`, `sync`, plus registration/status as needed).

## 5. Manifest v1

```yaml
version: 1
ssot: ../skills/obsidian-friendily-workflow/skills
defaults:
  agents: [cursor]
deploy:
  method: link
skills:
  - name: obsidian-markdown
    path: obsidian/obsidian-markdown
    agents: [cursor, codex, opencode]
  - name: paper-md-ingest
    path: obsidian/paper-md-ingest
```

`ssot` is absolute or relative to the manifest file. `path` is relative to `ssot`, must stay inside its resolved root and point to a directory containing `SKILL.md`. `name` must equal its directory basename and valid frontmatter name. Missing `path` may resolve a unique scanned name; ambiguity fails. Missing agents uses defaults, falling back to Cursor; an explicit empty agents list deploys nowhere. Names and agent IDs must be validated; reject unknown fields, duplicate entries, unsupported versions and unsafe paths.

For Library sources, the UI may use Magpie's Library `skills` directory as the manifest SSOT. Check real paths and ownership carefully because Library entries can themselves be symlinks.

## 6. Files and ownership

- Commit `skills.manifest.yaml` to the project. Machine-local source/project registration and deployment ownership live in the plugin's config directory; CLI supports an explicit config directory for isolated testing.
- Generated project outputs are per-skill directories; add a clearly delimited plugin-specific ignore block only for managed deployment paths. Do not edit or impersonate Magpie's existing ignore block.
- Inventory records targets, sources, method, fingerprints and a content-only hash for copies, sufficient to refuse deletion or replacement after local edits and to tell permission drift apart from content edits. When a target already equals this Apply's output exactly, re-record ownership instead of reporting a conflict.
- Block before writing if any deployment parent (especially `.agents/skills`) is a symlink. Explain the conflict and migration steps; never remove the whole-directory symlink automatically.
- Refuse traversals, invalid skill names, destructive overlaps, source/target cycles, unsafe target parents and unmanaged existing outputs. Treat dangling links as collisions unless owned.
- Apply is serialized and uses staged replacements and durable ownership updates. Report partial failures honestly; retain ownership of any surviving outputs so recovery does not silently orphan them.

## 7. Interface

A compact bilingual-capable workspace UI with a source/category browser, project sidebar and project detail. Show the project's manifest, agent selections, link/copy method, plan and sync state. Include register/remove controls, create/save manifest, Dry run, Apply, Sync all, Library source discovery and reveal-folder actions. Provide clear empty states and inline errors. All destructive cleanup follows recorded ownership, not name matching.

## 8. Scope limits

No new LLM provider/gateway, no Skills Market replacement, no Magpie fork, no direct Library state-file writes, no automatic ob-notes symlink migration, no public release during this task. Group aliases, version pins, lockfile interoperability, WSL and mass-worktree discovery are later work.

## 9. Implementation phases and commits

Each phase ends with relevant checks and an immediate English Conventional Commit before starting the next phase. Stage explicit paths only, preserve unrelated changes, and do not rewrite history.

- S0: spec revision, package/host proof, local install feasibility, documented Library and agent contracts.
- S1: manifest schema, categorized scanning and pure deployment planning, with adversarial validation tests.
- S2: safe apply, inventory, drift/cleanup, CLI and integration checks in temporary Git repositories.
- S3: workspace UI and local service APIs; verify the complete user flow in a browser and the Magpie launcher.
- S4: docs, real SSOT/ob-notes read-only acceptance, packaged local install, runtime verification and final cleanup.

## 10. Acceptance

- Local directory installs and runs inside the official local Magpie app without rebuilding it.
- Real SSOT scanning shows `blog`, `dev`, `obsidian`, `writing` and their skills, reporting invalid entries explicitly.
- A temporary Git project using an ob-notes fixture deploys only selected skills to verified agent paths in link/copy mode.
- Repeat Apply is idempotent; removing entries cleans only owned, unmodified targets. Modified copies and replaced links are conflicts unless the target exactly equals the intended output, in which case ownership is re-recorded.
- Dry run and conflict checks do not mutate project files. The existing ob-notes whole-directory symlink is detected and preserved.
- keep=true unregister preserves outputs. CLI and UI share the same engine and manifest.
- Local service rejects missing tokens, untrusted Host headers, invalid paths and malformed requests.
- Final report states repository URL, phase commits, checks, installed plugin location and any actual limitations.

## 11. References and local fixture

- https://github.com/magpie-community/plugins/tree/main/packages/chat
- https://github.com/magpie-community/plugins#pages
- https://usemagpie.ai/docs/zh/plugins
- https://github.com/yetone/magpie/blob/main/internal/library/projects.go
- https://github.com/yetone/magpie/blob/main/docs/subsystems/library.md

Real project: `/Users/zhuo/Developer/ob-notes`.
Real SSOT: `/Users/zhuo/Developer/skills/obsidian-friendily-workflow/skills`.
Initial skill names: `obsidian-markdown`, `obsidian-vault`, `obsidian-format-validation`, `learning-unit-ingest`, `paper-md-ingest`, `knowledge-radar-actions`, `obsidian-public-sync` (validate against disk).
The existing `.agents/skills` symlink is an expected conflict fixture, not permission to migrate it.
