# Workspace UI

Open **Magpie → Plugins → Skill Workspaces** (技能工作区). The page runs in the official Magpie host; the package includes the loopback service it needs.

1. Add a categorized Skill source, or choose **Read Magpie Library**. Categories organize the browser; the containing folder and frontmatter identify each skill.
2. Register a Git repository and, optionally, its manifest path.
3. Select skills, choose default agents and link/copy mode. Each selected row can inherit the defaults or override the five primary agents. Additional agent IDs can be edited in YAML.
4. Save the manifest, preview the sync plan, then Apply. Preview can inspect unsaved YAML, but Apply always reads the saved file again and validates current ownership.
5. Use Sync all for all registered projects, or unregister a project while keeping its deployed files.

Chinese/English and light/dark themes are supported. The full manifest remains editable. Saving refuses to overwrite a manifest edited externally since it was loaded.

The service accepts only loopback Host headers. APIs require a random token injected into its own page. Magpie's sandbox has opaque Origin `null`, so only API responses/preflights allow that origin; HTML does not carry CORS headers and the API still requires its token. Library metadata and skills are read as sources; project deployments are managed by this plugin, not Magpie's built-in Projects panel.
