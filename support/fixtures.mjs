import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
export async function fixture(t) {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'skill-workspaces-')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const dir = path.join(base, 'project'),
    ssot = path.join(base, 'skills');
  await mkdir(path.join(dir, '.git'), { recursive: true });
  for (const cat of ['dev', 'writing']) {
    const name = cat === 'dev' ? 'sample-skill' : 'writing-skill';
    await mkdir(path.join(ssot, cat, name), { recursive: true });
    await writeFile(
      path.join(ssot, cat, name, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Useful skill\n---\nBody\n`,
    );
  }
  const manifestPath = path.join(dir, 'skills.manifest.yaml');
  const text = `version: 1\nssot: ../skills\ndefaults:\n  agents: [cursor, codex, claude]\nskills:\n  - name: sample-skill\n    path: dev/sample-skill\n`;
  await writeFile(manifestPath, text);
  return { base, dir, ssot, manifestPath, text };
}
