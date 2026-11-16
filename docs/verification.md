# Verification — 2026-11-16

Environment: macOS, official Magpie 0.1.4306, its Bun plugin host, and Node for the standalone test suite/CLI.

- Kago is the English and Chinese plugin title, `@ffy6511/kago` is the package name, and `kago` is the installed CLI command. Both READMEs display the generated transparent basket icon at 160 × 160 pixels.
- `bun install --frozen-lockfile`, `bun run check`, `bun run format:check` and all 44 tests pass. The CLI help displays Kago, and both README image references resolve.
- `npm pack` includes `page/kago-icon.png`, the `magpie.page.icon` declaration, the page, host service and README files. An extracted package installed into an isolated official Magpie configuration resolves its dependencies, serves the Kago page and exposes the same PNG through the host's sidebar icon URL.
- The daily checkout installation was refreshed and enabled. After reloading the official desktop window, the sidebar visibly shows the colored Kago basket logo and the plugin page loads with its existing 7 selected skills and 14 workspace entries. Plugin options, project registrations and deployment ownership remain unchanged; no real project manifest or skill deployment was written.

# Verification — 2026-11-12

Environment: macOS, official Magpie 0.1.3899, its Bun plugin host, and Node for the standalone test suite/CLI.

## Completed checks

- 44 automated tests pass, including workspace skill read/save for real directories and link targets, broken-link and unsafe-path rejection, token enforcement, external-change protection, `SKILL.md` identity validation, merged manifest-and-deploy sync, stale-baseline rejection and conflict-without-write.
- `bun run check` and `bun run format:check` pass.
- `npm pack` includes the updated host, page, server, workspace resolver and documentation; the packaged page has no standalone Save action and sends the current draft through Sync.
- The local checkout is installed and enabled in the daily Magpie app. In the official sandbox, the header has no Save action. With no draft changes, **Cancel changes** is absent; selecting a skill makes it appear and suppresses the redundant unsynced label. Clicking blank space in a skill row toggles that row's selection, while clicking the skill name opens the shared reader without changing the selection. Sync on a temporary Git project created `skills.manifest.yaml` and the matching deployment link in one action. The temporary registration and directory were removed afterward.
- In the same official sandbox, **Existing** shows its workspace links as openable buttons; a link opens at `SKILL.md`, enters edit mode, cancels without writing, and restores focus to the same row after closing.
- A temporary Git project with a real workspace skill opened from **Existing**, saved through the shared reader, and the new text was read back from disk. The temporary project was then unregistered and removed without changing the user's real skills.

# Verification — 2026-11-05

Environment: macOS, official Magpie 0.1.3037, its Bun plugin host, and Node for the standalone test suite/CLI.

## Completed checks

- 17 automated tests pass: schema, scan, path, ownership, copy update, modified-output protection, whole-directory symlink conflict, manifest save concurrency, writer-lock, missing-output, stale-project removal, interruption recovery and HTTP boundaries.
- HTTP token, untrusted Host/Origin, malformed JSON and request-size checks. Opaque-origin API responses work inside Magpie's page sandbox; HTML does not expose its token through CORS.
- Real categorized SSOT: 26 valid skills in `blog` (4), `dev` (9), `obsidian` (7), `writing` (6); no scan problems.
- Existing Magpie Library: 82 valid skills; no scan problems. Its settings and global agent switches were not changed.
- Browser flow: register source/project, select `obsidian-markdown`, choose Cursor/Codex, save YAML, preview one deduplicated shared destination, Apply and verify an unchanged repeat preview. Verified official Magpie embedded page loading, English/dark mode and manual YAML-to-form editing with copy deployment.
- Packaged host flow: `npm pack`, extract into a clean directory, install locally into an isolated official Magpie configuration, and load the host service. In that Magpie/Bun host, deploy all seven real Obsidian skills to 14 shared/Claude destinations, repeat Apply, convert links to copies and clean owned outputs.
- The desktop app has the plugin installed and enabled. Its page opens with the existing source and project registrations; no development server is needed.
- Read-only acceptance on an existing project reports the whole-directory `.agents/skills` symlink conflict and preserves it. No project manifest or deployment files were written during acceptance.

## Boundaries

Earlier Magpie versions, Windows/Linux native filesystem behavior and remote `magpie web` access were not validated. The plugin does not mutate Magpie's built-in Projects registry. Existing deployment ownership is not imported. Group aliases, version pins and lock-file interoperability are deferred. Source skills with nested symlinks require adjustment before deployment.
