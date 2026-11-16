## Summary

<!-- What changed and why? -->

## Related issue

<!-- Closes #123, or "None". -->

## Behavior changed

<!-- Describe the user-visible behavior or contract change. Write "None" for docs-only changes. -->

## Verification

- `bun run check`:
- `bun run format:check`:
- `bun run test`:
- Magpie sandbox / UI:
- `npm pack`:

## Deployment and packaging impact

<!-- For manifest, preview/apply, ownership, CLI, service, packaging, or UI changes, state what was verified. Write "N/A" for docs-only changes. -->

- [ ] Preview remains read-only when touched
- [ ] Apply and ownership safety is covered by tests when touched

## Checklist

- [ ] Tests were added or updated for behavior changes
- [ ] Documentation was updated for contract changes
- [ ] UI and host changes were verified in the official Magpie sandbox
- [ ] The local plugin installation was refreshed after implementation
- [ ] No credentials, tokens, or private paths are included
