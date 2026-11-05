# Magpie native UI assets

Source: https://github.com/yetone/magpie (MIT; license included).

- `bridge.js`: `internal/gui/pagebridge.js`, with an outer iframe-only guard for standalone previews.
- `base.css`: the native base stylesheet (formatting only) from that bridge.
- SVGs: `internal/gui/assets/icons/`, reused for their corresponding agents. These retain the upstream assets; no logos are redrawn.
- `controls.css`: native Library agent chip rules (formatting only) from `internal/gui/assets/plugins/library/library.css`.

Runtime theme values come directly from Magpie's bridge. No parent DOM access or Magpie internal API access is required.

`components.css` contains the native popup/protocol menu, modal/editor, and Library Skill reader rules from `internal/gui/assets/app.css` and `internal/gui/assets/plugins/library/library.css`. `ui/native-ui.js` adapts the corresponding menu and dialog interactions for the standalone plugin page.

The file picker, path link and file editor also follow `viewSkill`, `pathLink` and their associated Library rules. `ui/skill-reader.js` adapts those interactions to this plugin’s source-file API; it does not expose Magpie’s private Library mutation API.
