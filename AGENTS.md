# Agent guide

This file is the entry point for agents working in this repository. Keep it focused on stable architecture, boundaries and working agreements. Put feature details, current UI layouts and verification records in the relevant documents instead.

## Read before working

- Read `README.md` for the product and local development workflow, then `docs/spec.md` for scope and behavior contracts.
- Read `docs/integration.md` and `docs/distribution.md` before changing Magpie integration, packaging or installation.
- For UI work, read `docs/ui.md` and `ui/vendor/magpie/NOTICE.md`; inspect the corresponding official Magpie implementation before designing a replacement.
- For deployment or filesystem work, read `docs/cli.md` and the relevant tests. `docs/verification.md` records past checks; verify current behavior rather than treating historical results as guarantees.
- Inspect Git status and existing changes before editing. Preserve user work, staged changes and unrelated files.

## Architecture and boundaries

- This is an independently installable Magpie plugin, distributed as one npm-compatible package. It runs in the official app without a Magpie fork or rebuild.
- `package.json` declares the plugin, page and host service. `index.mjs` is the ESM host entry; `page/` launches the service UI from Magpie's sandbox using its official bridge.
- `ui/` contains the client, host-theme integration and interaction adapters. `ui/vendor/magpie/` contains attributed upstream styles, bridge code and icons.
- `src/server.mjs` serves the local page and APIs. Keep it loopback-only and preserve token, Host, Origin, request-size and content-safety boundaries, including opaque-origin sandbox support.
- `src/engine.mjs` coordinates operations; `src/manifest.mjs`, `src/skills.mjs`, `src/plan.mjs` and `src/store.mjs` handle validation, scanning, planning and durable ownership. `src/skill-document.mjs` renders document previews. `cli.mjs` and the UI use the same engine.
- The project manifest is versioned intent. Registration, ownership and recovery state are machine-local. Magpie Library is a read-only source; do not rewrite its registry, change global agent switches or adopt its outputs implicitly.
- Preview must remain read-only. Apply must validate before writing, deduplicate shared destinations and preserve locking, recovery and fingerprint checks. Never replace unmanaged or locally modified files, or automatically migrate whole-directory symlinks.

## UI principles

- Reuse Magpie's official components, styles, theme tokens, typography, agent icons and interaction conventions wherever available. Check the host implementation first; do not recreate controls from memory or introduce a competing design system.
- Prefer supported public integration points. When a native component is not exported to plugin pages, adapt the smallest necessary upstream styles and behavior locally, retain license/attribution, and document the boundary. Do not depend on parent DOM access or private mutation APIs.
- Keep custom CSS focused on workspace layout and essential adaptations. Maintain host theme/language behavior and consistent hover, focus, selection, disabled and open/close transitions; respect reduced-motion preferences.
- Favor a simple purpose, architecture, design and implementation. Remove taglines, helper copy and secondary labels that merely repeat what the layout already communicates. Keep necessary names, errors and actionable guidance.
- Preserve keyboard navigation, accessible names, focus handling and clear control states. Evaluate changes for user experience, developer experience and agent operability together.
- Keep task-specific screen descriptions and pixel-level decisions out of this file.

## Development and local acceptance

- Use the existing toolchain and keep dependencies and the lockfile consistent. Run `bun install --frozen-lockfile` when preparing a checkout.
- Run `bun run check`, `bun run format:check` and tests appropriate to the changed behavior (`bun run test` for shared engine/API changes). Add meaningful regression coverage for behavioral fixes; avoid tests that only mirror cosmetic implementation details.
- After every completed implementation change, build/package the current plugin and install or refresh it in the user's local Magpie before handing it back. Source-only edits or a standalone browser preview do not complete delivery.
- Currently the package runs ESM and static assets directly; there is no separate compile script. Use `npm pack --pack-destination <temporary-directory>` to produce and inspect the distributable. If a build pipeline is introduced, run it before packaging and installation.
- Refresh the existing local checkout installation with the commands below. Resolve the actual Magpie executable and checkout path on the machine; on macOS the executable may be `/Applications/magpie.app/Contents/MacOS/magpie`.

```sh
magpie plugin off <absolute-checkout-path>
magpie plugin add <absolute-checkout-path>
magpie plugin on <absolute-checkout-path>
```

- Preserve the user's unsaved plugin draft before reloading the desktop page, restore it afterward, and keep it unsaved unless the user requested saving it. Preserve plugin options and registration state.
- Reload the installed page and verify the affected flow inside the official Magpie sandbox. Confirm the running host picked up service/dependency changes; cached UI or an old host process is not acceptance. For packaging changes, also test an extracted package in an isolated host configuration.
- Use temporary Git projects and isolated plugin state for deployment tests. Installing an updated plugin does not authorize saving manifests, applying deployments or migrating links in the user's real projects.
- Report what changed, checks performed, local installation status and any actual limitation. Do not claim an installation or interaction succeeded without observing it.

## Change discipline

- Keep changes small and update the owning documentation when behavior or integration contracts change.
- Follow the user's current commit instruction. When commits are requested, create English Conventional Commits at logical phase boundaries, stage explicit paths and preserve existing history. Do not commit, push or publish merely because local installation is required.
- Keep runtime-specific paths, versions, skill counts, screenshots and temporary workarounds in task records or focused documentation rather than turning them into permanent rules here.
