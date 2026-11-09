# CLI and ownership

Run `node cli.mjs --help` or the installed `skill-workspaces` command. Commands return JSON; exit 0 means success, 2 means conflicts in a plan/sync, and 1 means a command error.

```sh
node cli.mjs source add /path/to/categorized/skills
node cli.mjs project add /path/to/repo
node cli.mjs plan /path/to/repo
node cli.mjs apply /path/to/repo
node cli.mjs sync
node cli.mjs project remove /path/to/repo --keep
```

Use `--config-dir /tmp/workspaces-test` for an isolated registry/inventory; `--magpie-dir` chooses the Library config root. `--manifest` chooses a YAML path inside the project; omitting it when re-registering keeps the current path. A project must contain `.git`, including a worktree's `.git` file.

Only outputs recorded in the plugin inventory can be updated or removed, and their fingerprints must still match. Local edits and unmanaged destinations block the whole preflight, except that a target exactly equal to the intended output is adopted and re-recorded. Copy conflicts are reported as content edits or permission-only drift. The plugin uses its own .gitignore block and serializes writes across the CLI and service. It journals each replacement before renaming staged outputs; the next mutation reconciles interrupted work by fingerprints. A partial failure retains completed output ownership and is reported as a failure; Apply can then finish the remaining operations.

`project remove --keep` (the default) preserves outputs and the ignore block and relinquishes ownership. `--clean` removes only unmodified owned outputs. Re-registering a kept project does not silently adopt its old outputs; migrate those explicitly if you want to resume management.

A whole-directory `.agents/skills` symlink must be backed up and migrated manually before Apply. Nested symlinks inside source skills are refused in v1, so copy never reads an unexpected external file. Library top-level folder links are supported when the source is the configured Magpie Library root.
