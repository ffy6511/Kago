# Magpie integration contract

Verified on 2026-11-05 against local Magpie 0.1.3037 and upstream `internal/library/projects.go`.

- Magpie CLI supports `plugin add <path>`. Community `packages/chat` proves the page + ESM host service pattern. This package follows that pattern; it never imports Magpie internal Go packages.
- The installed `magpie library --help` exposes no project mutation commands. The plugin therefore reads Library sources and projects and owns its own project deployments. It does not write `library.json`, invoke undocumented GUI writes, or change global agent switches.
- `cursor`, `codex`, `opencode`, `gemini` share `.agents/skills`; `claude` uses `.claude/skills`. Shared paths must be deduplicated. Additional supported mappings follow upstream.
- Library discovery reads `$XDG_CONFIG_HOME/magpie/library.json` and `library/skills`, or the normal `~/.config/magpie` location. Config paths can be overridden for portable installations.
- Package source remains private; npm publication and marketplace registry submission are later release actions. The package has no dependency on a public npm scope for local installation.

References: https://github.com/magpie-community/plugins/tree/main/packages/chat and https://github.com/yetone/magpie/blob/main/internal/library/projects.go
