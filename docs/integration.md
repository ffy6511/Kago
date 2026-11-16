# Magpie integration contract

Verified on 2026-11-05 against local Magpie 0.1.3037 and upstream `internal/library/projects.go`.

- Magpie CLI supports `plugin add <path>`. Community `packages/chat` proves the page + ESM host service pattern. This package follows that pattern; it never imports Magpie internal Go packages.
- The installed `magpie library --help` exposes no project mutation commands. The plugin therefore reads Library sources and projects and owns its own project deployments. It does not write `library.json`, invoke undocumented GUI writes, or change global agent switches.
- `cursor`, `codex`, `opencode`, `gemini` share `.agents/skills`; `claude` uses `.claude/skills`. Shared paths must be deduplicated. Additional supported mappings follow upstream.
- Library discovery reads `$XDG_CONFIG_HOME/magpie/library.json` and `library/skills`, or the normal `~/.config/magpie` location. Config paths can be overridden for portable installations.
- Skill file browsing/editing uses the plugin’s own validated source-file APIs. Explicit saves update existing UTF-8 files within a scanned skill, preserve modes and reject stale editor content; Library registry and global switches remain untouched.
- Deployment detection resolves known agent paths against the scanned source, including link chains and whole-directory links, without changing manifests or ownership. Shared paths are deduplicated; their existence does not prove that every agent using that directory is configured.
- The sidebar loads Kago's colored basket logo through the supported `magpie.page.icon` field. `page/kago-icon.png` lives inside the launcher's directory, as Magpie requires, and is also used by both READMEs. The host renders the colored image directly.
- Package source remains private; npm publication and marketplace registry submission are later release actions. The package has no dependency on a public npm scope for local installation.

References: https://github.com/magpie-community/plugins/tree/main/packages/chat and https://github.com/yetone/magpie/blob/main/internal/library/projects.go
