import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { AGENTS, exists, fingerprint } from './skills.mjs';
import { checkParents } from './plan.mjs';

// Disk observation is independent of desired manifest entries and ownership.
// Matching an external link never adopts it or grants permission to remove it.
export async function detectDeployments({ dir, scan, inventory = {} }) {
  const skills = [],
    problems = [];
  for (const skill of scan.skills) {
    const targets = [];
    for (const folder of new Set(Object.values(AGENTS))) {
      const relative = `${folder}/${skill.name}`,
        target = path.join(dir, relative);
      try {
        const info = await exists(target);
        if (!info) continue;
        const owned = inventory[relative];
        let parentLinked = false;
        try {
          await checkParents(dir, relative);
        } catch {
          parentLinked = true;
        }
        const resolved = await realpath(target);
        const linked = (info.isSymbolicLink() || parentLinked) && resolved === skill.dir;
        let copied = false,
          current = null;
        if (
          owned?.source === skill.dir &&
          !info.isSymbolicLink() &&
          !parentLinked &&
          owned.method === 'copy'
        ) {
          current = await fingerprint(target);
          copied = current === owned.fingerprint;
        }
        if (!linked && !copied) continue;
        if (linked && owned && !parentLinked) current = await fingerprint(target);
        targets.push({
          relative,
          method: linked ? 'link' : 'copy',
          parentLinked,
          managed:
            !parentLinked &&
            owned?.source === skill.dir &&
            owned.method === (linked ? 'link' : 'copy') &&
            current === owned.fingerprint,
          agents: Object.keys(AGENTS).filter((agent) => AGENTS[agent] === folder),
        });
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR')
          problems.push({ path: relative, error: error.message });
      }
    }
    if (targets.length) skills.push({ name: skill.name, path: skill.path, targets });
  }
  return { skills, problems };
}
