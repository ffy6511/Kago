import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { lstat, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { fixture } from '../support/fixtures.mjs';
import { Engine } from '../src/engine.mjs';

const setup = async (t) => {
  const f = await fixture(t);
  const e = new Engine({ configDir: path.join(f.base, 'config') });
  await e.registerProject(f.dir);
  assert((await e.apply(f.dir)).ok);
  return { ...f, e };
};

test('workspace skills distinguish links from real folders and delete only confirmed targets', async (t) => {
  const f = await setup(t),
    manual = path.join(f.dir, '.agents/skills/manual-skill'),
    linked = path.join(f.dir, '.claude/skills/writing-skill'),
    linkSource = path.join(f.ssot, 'writing/writing-skill');
  await mkdir(manual);
  await writeFile(
    path.join(manual, 'SKILL.md'),
    '---\nname: manual-skill\ndescription: Workspace-owned skill\n---\nBody\n',
  );
  await symlink(linkSource, linked, 'dir');

  const listed = await f.e.workspaceSkills(f.dir),
    folder = listed.skills.find((skill) => skill.relative === '.agents/skills/manual-skill'),
    link = listed.skills.find((skill) => skill.relative === '.claude/skills/writing-skill');
  assert.equal(folder.kind, 'directory');
  assert.equal(folder.name, 'manual-skill');
  assert.equal(link.kind, 'link');
  assert.equal(link.target, linkSource);
  assert.equal(link.targetExists, true);
  assert.deepEqual(link.agents, ['claude']);
  assert(
    listed.skills.some(
      (skill) => skill.relative === '.agents/skills/sample-skill' && skill.kind === 'link',
    ),
  );

  await assert.rejects(
    f.e.removeWorkspaceSkill(f.dir, folder.relative, '0'.repeat(64)),
    /changed after confirmation/,
  );
  assert((await lstat(manual)).isDirectory());
  await f.e.removeWorkspaceSkill(f.dir, folder.relative, folder.fingerprint);
  await assert.rejects(lstat(manual), { code: 'ENOENT' });

  await f.e.removeWorkspaceSkill(f.dir, link.relative, link.fingerprint);
  await assert.rejects(lstat(linked), { code: 'ENOENT' });
  assert((await lstat(linkSource)).isDirectory());
  await assert.rejects(
    f.e.removeWorkspaceSkill(f.dir, '.agents/skills/../escaped', '0'.repeat(64)),
    /Unsafe managed target/,
  );
});

test('workspace listing and deletion refuse a linked skills parent', async (t) => {
  const f = await fixture(t);
  await mkdir(path.join(f.dir, '.agents'), { recursive: true });
  await symlink(f.ssot, path.join(f.dir, '.agents/skills'));
  const e = new Engine({ configDir: path.join(f.base, 'config') }),
    listed = await e.workspaceSkills(f.dir);
  assert.equal(listed.skills.length, 0);
  assert.match(listed.problems[0].error, /Deployment parent is a symlink/);
  assert.equal(listed.problems[0].conflict.kind, 'parent-symlink');
  await assert.rejects(
    e.removeWorkspaceSkill(f.dir, '.agents/skills/sample-skill', '0'.repeat(64)),
    /Deployment parent is a symlink/,
  );
  await assert.rejects(
    e.readWorkspaceSkillDocument(f.dir, '.agents/skills/sample-skill'),
    /Deployment parent is a symlink/,
  );
  assert((await lstat(path.join(f.ssot, 'dev/sample-skill'))).isDirectory());
});

test('workspace skills open and save real folders and link targets', async (t) => {
  const f = await setup(t),
    manual = path.join(f.dir, '.agents/skills/manual-skill'),
    linked = path.join(f.dir, '.claude/skills/writing-skill'),
    linkSource = path.join(f.ssot, 'writing/writing-skill');
  await mkdir(manual);
  await writeFile(
    path.join(manual, 'SKILL.md'),
    '---\nname: manual-skill\ndescription: Workspace-owned skill\n---\nBody\n',
  );
  await symlink(linkSource, linked, 'dir');

  const manualDoc = await f.e.readWorkspaceSkillDocument(f.dir, '.agents/skills/manual-skill');
  assert.equal(manualDoc.name, 'manual-skill');
  assert.equal(manualDoc.directory, manual);
  assert.match(manualDoc.html, /<p>Body/);
  const savedManual = await f.e.saveWorkspaceSkillDocument(
    f.dir,
    '.agents/skills/manual-skill',
    'SKILL.md',
    manualDoc.text + 'Edited folder\n',
    manualDoc.text,
  );
  assert.match(savedManual.text, /Edited folder/);
  assert.match(await readFile(path.join(manual, 'SKILL.md'), 'utf8'), /Edited folder/);
  await assert.rejects(
    f.e.saveWorkspaceSkillDocument(
      f.dir,
      '.agents/skills/manual-skill',
      'SKILL.md',
      savedManual.text.replace('name: manual-skill', 'name: wrong-name'),
      savedManual.text,
    ),
    /Frontmatter name/,
  );
  await assert.rejects(
    f.e.saveWorkspaceSkillDocument(
      f.dir,
      '.agents/skills/manual-skill',
      'SKILL.md',
      savedManual.text + 'External edit\n',
      manualDoc.text,
    ),
    /changed outside/,
  );
  assert.equal(await readFile(path.join(manual, 'SKILL.md'), 'utf8'), savedManual.text);

  const linkedDoc = await f.e.readWorkspaceSkillDocument(f.dir, '.claude/skills/writing-skill');
  assert.equal(linkedDoc.directory, linkSource);
  await f.e.saveWorkspaceSkillDocument(
    f.dir,
    '.claude/skills/writing-skill',
    'SKILL.md',
    linkedDoc.text + 'Edited target\n',
    linkedDoc.text,
  );
  assert.match(await readFile(path.join(linkSource, 'SKILL.md'), 'utf8'), /Edited target/);

  const broken = path.join(f.dir, '.agents/skills/broken-skill');
  await symlink(path.join(f.base, 'missing-skill'), broken, 'dir');
  await assert.rejects(
    f.e.readWorkspaceSkillDocument(f.dir, '.agents/skills/broken-skill'),
    /link target is missing/,
  );
  await assert.rejects(
    f.e.readWorkspaceSkillDocument(f.dir, '.agents/skills/../escaped'),
    /Unsafe managed target/,
  );
});
