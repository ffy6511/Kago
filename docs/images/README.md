# README walkthrough images

Captured on 2026-11-16 from the running Kago page in English and Chinese, using an isolated source library and temporary Git project. The images show real selection, preview, deployment and reader states. Numbered borders and explanatory captions were added as temporary HTML overlays before capture. Every image is captured at 2200 × 1400 pixels (2× density for a 1100 × 700 content area), then losslessly compressed as PNG without resizing. Both READMEs use a two-column, two-row gallery with matching 550 × 350 image boxes, captions underneath and links to the full-resolution files. The reader overlay was centered within the capture. These presentation adjustments do not change the application's controls or behavior.

- `select-{en,zh}.png`: `paper-notes` selects `paper-md-ingest` and `writing-style` from `team-skills`. Cursor and Codex are the defaults; `writing-style` overrides them with Claude Code.
- `preview-{en,zh}.png`: Preview reports two creates, with a single shared `.agents/skills/paper-md-ingest` output and a `.claude/skills/writing-style` output.
- `existing-{en,zh}.png`: after Sync, Existing lists the two actual relative symlinks and their source targets.
- `reader-{en,zh}.png`: the deployed `paper-md-ingest` link opens its real `SKILL.md`. The document was read without saving any edits.

The example source also contains unselected `code-review` and `citation-check` skills. The YAML and output tree in both READMEs describe the same selection. Documentation uses portable relative paths; the reader footer shows `team-skills/research/paper-md-ingest/SKILL.md`. No user's project, Library registry or global agent setting was changed for these captures.
