# Workspace UI

Open **Magpie → Plugins → Skill Workspaces** (技能工作区).

1. Choose a project in the top selector, or use `+` to add one. Source registration and Magpie Library discovery are in the `…` menu.
2. Choose a source and category, then check the skills to deploy. Click a skill name to inspect its description and path.
3. The top agent chips set project defaults; selected rows offer the same agent icons for overrides. The reset icon returns a row to project defaults. Tooltips and accessible names identify every icon.
4. Use **Save → Preview → Sync**. The Manifest and Changes tabs provide YAML editing and the deployment plan.
5. The `…` menu offers refresh, sync-all, opening the project folder and unregistering while keeping deployed files.

The page uses Magpie's official page bridge, including its base control styles and live theme/language events after navigating to the local service. Library agent-chip rules and upstream SVG assets are bundled with attribution. Only the workspace layout is plugin-specific; the palette and font come from `--magpie-*` tokens. Standalone CLI previews use Magpie's standard light/dark defaults.

The service accepts only loopback Host headers. APIs require a random token injected into its own HTML. Magpie's opaque-origin API and static icon requests allow Origin `null`; HTML never carries CORS headers. Library metadata is read as a source, while this plugin owns its own project deployments.
