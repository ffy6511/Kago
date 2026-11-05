import path from 'node:path';
import { realpath, lstat, readlink } from 'node:fs/promises';
import { AGENTS, exists, inside, fingerprint, validName } from './skills.mjs';
import { resolveManifest } from './manifest.mjs';

export async function projectRoot(dir) {
  const root = await realpath(path.resolve(dir));
  if (!(await lstat(root)).isDirectory() || !(await exists(path.join(root, '.git'))))
    throw new Error('Choose a Git repository root containing .git (worktrees are supported)');
  return root;
}
export function validTarget(relative) {
  return (
    typeof relative === 'string' &&
    Object.values(AGENTS).some(
      (d) =>
        relative.startsWith(d + '/') &&
        path.posix.dirname(relative) === d &&
        validName(path.posix.basename(relative)),
    )
  );
}
export async function checkParents(root, relative) {
  if (!validTarget(relative)) throw new Error(`Unsafe managed target: ${relative}`);
  let current = root;
  for (const part of relative.split('/').slice(0, -1)) {
    current = path.join(current, part);
    const info = await exists(current);
    if (info && (!info.isDirectory() || info.isSymbolicLink()))
      throw new Error(
        `Deployment parent is a symlink or not a directory: ${current}. Back up and migrate it manually to per-skill folders first.`,
      );
  }
}
export async function planProject({
  dir,
  manifestPath = path.join(dir, 'skills.manifest.yaml'),
  inventory = {},
  text,
  libraryRoot,
}) {
  const root = await projectRoot(dir);
  const manifest = await resolveManifest(manifestPath, { text, libraryRoot });
  const wanted = new Map(),
    operations = [],
    problems = [];
  for (const skill of manifest.skills)
    for (const agent of skill.agents) {
      const relative = `${AGENTS[agent]}/${skill.name}`;
      const target = path.join(root, relative);
      if (inside(skill.source, target) || inside(target, skill.source))
        throw new Error(`Source/target overlap: ${skill.name}`);
      const previous = wanted.get(relative);
      wanted.set(relative, {
        relative,
        name: skill.name,
        source: skill.source,
        sourceFingerprint: skill.fingerprint,
        method: manifest.doc.deploy.method,
        agents: [...new Set([...(previous?.agents || []), agent])],
      });
    }
  for (const relative of [...new Set([...wanted.keys(), ...Object.keys(inventory)])].sort()) {
    const desired = wanted.get(relative),
      owned = inventory[relative];
    try {
      await checkParents(root, relative);
      const target = path.join(root, relative),
        info = await exists(target),
        current = await fingerprint(target);
      if (info && !owned)
        throw new Error(
          'Existing target is not owned by Skill Workspaces; nothing will be overwritten',
        );
      if (info && owned && current !== owned.fingerprint)
        throw new Error(
          'Managed target was edited or replaced locally; preserve or resolve it before syncing',
        );
      if (!desired) {
        operations.push({ action: info ? 'remove' : 'forget', relative, owned });
        continue;
      }
      let same = false;
      if (info && owned?.method === desired.method) {
        same =
          desired.method === 'copy'
            ? current === desired.sourceFingerprint
            : info.isSymbolicLink() &&
              (await readlink(target)) === path.relative(path.dirname(target), desired.source);
      }
      operations.push({
        ...desired,
        action: !info ? 'create' : same ? 'unchanged' : 'update',
        owned,
      });
    } catch (e) {
      const problem = { relative, error: e.message };
      problems.push(problem);
      operations.push({ action: 'conflict', ...problem });
    }
  }
  return {
    dir: root,
    manifestPath: path.resolve(manifestPath),
    manifest: manifest.doc,
    operations,
    problems,
    ok: problems.length === 0,
  };
}
