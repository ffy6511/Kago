import path from 'node:path';
import { realpath, readdir, readlink, rm, stat } from 'node:fs/promises';
import { AGENTS, exists, fingerprint, validName } from './skills.mjs';
import { checkParents } from './plan.mjs';

const folders = [...new Set(Object.values(AGENTS))].sort();
const missing = (error) => error?.code === 'ENOENT' || error?.code === 'ENOTDIR';

async function readWorkspaceSkill(root, folder, name) {
  const relative = `${folder}/${name}`,
    target = path.join(root, relative),
    info = await exists(target);
  if (!info) return null;

  let link = null,
    linkExists = true;
  if (info.isSymbolicLink()) {
    link = await readlink(target);
    try {
      if (!(await stat(target)).isDirectory()) return null;
    } catch (error) {
      if (!missing(error)) throw error;
      linkExists = false;
    }
  } else if (!info.isDirectory()) return null;

  return {
    name,
    relative,
    folder,
    kind: info.isSymbolicLink() ? 'link' : 'directory',
    ...(link === null ? {} : { target: link, targetExists: linkExists }),
    agents: Object.keys(AGENTS).filter((agent) => AGENTS[agent] === folder),
    fingerprint: await fingerprint(target),
  };
}

export async function resolveWorkspaceSkill(root, relative) {
  await checkParents(root, relative);
  const folder = path.posix.dirname(relative),
    name = path.posix.basename(relative),
    skill = await readWorkspaceSkill(root, folder, name);
  if (!skill) throw new Error('Workspace skill is no longer a directory or link');
  if (skill.kind === 'link' && !skill.targetExists)
    throw new Error('Workspace skill link target is missing');
  return {
    ...skill,
    dir: await realpath(path.join(root, relative)),
  };
}

export async function detectWorkspaceSkills(root) {
  const skills = [],
    problems = [];
  for (const folder of folders) {
    try {
      await checkParents(root, `${folder}/check`);
    } catch (error) {
      problems.push({
        path: folder,
        error: error.message,
        ...(error.conflict ? { conflict: error.conflict } : {}),
      });
      continue;
    }
    try {
      for (const entry of await readdir(path.join(root, folder), { withFileTypes: true })) {
        if (entry.name.startsWith('.') || !validName(entry.name)) continue;
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        try {
          const skill = await readWorkspaceSkill(root, folder, entry.name);
          if (skill) skills.push(skill);
        } catch (error) {
          problems.push({ path: `${folder}/${entry.name}`, error: error.message });
        }
      }
    } catch (error) {
      if (!missing(error)) problems.push({ path: folder, error: error.message });
    }
  }
  return {
    skills: skills.sort(
      (a, b) => a.name.localeCompare(b.name) || a.relative.localeCompare(b.relative),
    ),
    problems,
  };
}

export async function removeWorkspaceSkill(root, relative, expectedFingerprint) {
  if (!/^[a-f0-9]{64}$/.test(expectedFingerprint))
    throw new Error('Reload the workspace before deleting this skill');
  await checkParents(root, relative);
  const target = path.join(root, relative),
    info = await exists(target);
  if (!info) throw new Error('Skill no longer exists; reload the workspace');
  if (!info.isDirectory() && !info.isSymbolicLink())
    throw new Error('Workspace skill is no longer a directory or link');
  if ((await fingerprint(target)) !== expectedFingerprint)
    throw new Error('Skill changed after confirmation; reload it before deleting');

  const removed = {
    ok: true,
    relative,
    name: path.posix.basename(relative),
    kind: info.isSymbolicLink() ? 'link' : 'directory',
    ...(info.isSymbolicLink() ? { target: await readlink(target) } : {}),
  };
  await rm(target, { recursive: info.isDirectory(), force: false });
  return removed;
}
