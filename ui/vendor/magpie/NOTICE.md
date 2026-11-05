# Magpie native UI assets

Source: https://github.com/yetone/magpie (MIT; license included).

- `bridge.js`: `internal/gui/pagebridge.js`, with an outer iframe-only guard for standalone previews.
- `base.css`: the native base stylesheet (formatting only) from that bridge.
- SVGs: `internal/gui/assets/icons/`, reused for their corresponding agents. These retain the upstream assets; no logos are redrawn.
- `controls.css`: native Library agent chip rules (formatting only) from `internal/gui/assets/plugins/library/library.css`.

Runtime theme values come directly from Magpie's bridge. No parent DOM access or Magpie internal API access is required.
