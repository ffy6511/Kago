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
const skillFolders = new Set(Object.values(AGENTS));
export async function checkParents(root, relative) {
  if (!validTarget(relative)) throw new Error(`Unsafe managed target: ${relative}`);
  let current = root;
  for (const part of relative.split('/').slice(0, -1)) {
    current = path.join(current, part);
    const info = await exists(current);
    if (info && (!info.isDirectory() || info.isSymbolicLink())) {
      const parent = path.relative(root, current).split(path.sep).join('/');
      let resolved = null;
      if (info.isSymbolicLink())
        try {
          resolved = await realpath(current);
        } catch {
          /* Dangling link */
        }
      throw conflict(
        `Deployment parent is a symlink or not a directory: ${current}. Back up and migrate it manually to per-skill folders first.`,
        {
          kind: info.isSymbolicLink() ? 'parent-symlink' : 'parent-not-directory',
          relative: parent,
          ...(info.isSymbolicLink() ? { target: await readlink(current) } : {}),
          ...(resolved ? { resolved } : {}),
          fixable: info.isSymbolicLink() && skillFolders.has(parent),
        },
      );
    }
  }
}
const short = (value) => String(value ?? '').slice(0, 12) + '…';
function conflict(message, detail) {
  const error = new Error(message);
  error.conflict = detail;
  return error;
}
function conflictMessage(detail) {
  switch (detail.kind) {
    case 'link-target':
      return `Managed link points to ${detail.actual} instead of ${detail.expected}; restore or remove it before syncing`;
    case 'link-replaced':
      return 'Managed link was replaced by a file or folder; restore or remove it before syncing';
    case 'copy-content':
      return 'Managed copy was edited locally; preserve or resolve it before syncing';
    case 'copy-modes':
      return 'Managed copy permissions were changed; restore them or remove the copy before syncing';
    case 'copy-replaced':
      return 'Managed copy was replaced by a link; preserve or resolve it before syncing';
    default:
      return 'Managed target was edited or replaced locally; preserve or resolve it before syncing';
  }
}
async function diagnose({ target, info, owned, current }) {
  if (owned.method === 'link') {
    const expected = path.relative(path.dirname(target), owned.source);
    return info.isSymbolicLink()
      ? { kind: 'link-target', expected, actual: await readlink(target) }
      : { kind: 'link-replaced', expected };
  }
  if (info.isSymbolicLink())
    return {
      kind: 'copy-replaced',
      expected: short(owned.fingerprint),
      actual: await readlink(target),
    };
  if (owned.content)
    return {
      kind:
        (await fingerprint(target, { modes: false })) === owned.content
          ? 'copy-modes'
          : 'copy-content',
      expected: short(owned.fingerprint),
      actual: short(current),
    };
  return { kind: 'copy', expected: short(owned.fingerprint), actual: short(current) };
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
        current = await fingerprint(target),
        wantedLink = desired ? path.relative(path.dirname(target), desired.source) : null,
        currentLink = info?.isSymbolicLink() ? await readlink(target) : null;
      if (info && !owned)
        throw conflict(
          'Existing target is not owned by Skill Workspaces; nothing will be overwritten',
          { kind: 'unmanaged' },
        );
      // A target that already equals this Apply's output contains nothing to preserve.
      const matchesDesired =
        !!desired &&
        !!info &&
        (desired.method === 'copy'
          ? current === desired.sourceFingerprint
          : currentLink === wantedLink);
      if (info && owned && current !== owned.fingerprint && !matchesDesired) {
        const detail = await diagnose({ target, info, owned, current });
        throw conflict(conflictMessage(detail), detail);
      }
      if (!desired) {
        operations.push({ action: info ? 'remove' : 'forget', relative, owned });
        continue;
      }
      const adopted = !!info && !!owned && current !== owned.fingerprint;
      let same = false;
      if (info && owned?.method === desired.method)
        same =
          desired.method === 'copy'
            ? current === desired.sourceFingerprint
            : currentLink === wantedLink;
      operations.push({
        ...desired,
        action: !info ? 'create' : same || adopted ? 'unchanged' : 'update',
        owned,
        ...(adopted ? { adopted: true, current } : {}),
      });
    } catch (e) {
      const problem = {
        relative,
        error: e.message,
        ...(e.conflict ? { conflict: e.conflict } : {}),
      };
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
