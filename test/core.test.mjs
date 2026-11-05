import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, symlink, readdir } from 'node:fs/promises';
import path from 'node:path';
import { scanSource } from '../src/skills.mjs';
import { parseManifest, resolveManifest } from '../src/manifest.mjs';
import { planProject } from '../src/plan.mjs';

import { fixture } from '../support/fixtures.mjs';
test('categorized scan and shared-agent plan are read-only', async (t) => {
  const f = await fixture(t),
    before = await readdir(f.dir);
  const scan = await scanSource(f.ssot);
  assert.deepEqual(
    scan.skills.map((s) => s.category),
    ['dev', 'writing'],
  );
  const plan = await planProject(f);
  assert.equal(plan.operations.length, 2);
  assert.deepEqual(plan.operations.find((o) => o.relative.startsWith('.agents')).agents, [
    'cursor',
    'codex',
  ]);
  assert.deepEqual(await readdir(f.dir), before);
});
test('schema rejects ambiguity, bad agent IDs, unsafe paths and duplicate YAML', () => {
  const base = 'version: 1\nssot: ../skills\nskills: []\n';
  for (const text of [
    base + 'unknown: true',
    base + 'version: 1',
    base.replace('[]', '[{name: ../escape}]'),
    base + 'defaults: {agents: [made-up]}',
    base.replace('[]', '[{name: sample, path: ../outside}]'),
    base.replace('[]', '[{name: sample}, {name: sample}]'),
  ])
    assert.throws(() => parseManifest(text));
  assert.deepEqual(parseManifest(base + 'defaults: {agents: []}').defaults.agents, []);
});
test('whole-directory symlink blocks all writes', async (t) => {
  const f = await fixture(t);
  await mkdir(path.join(f.dir, '.agents'));
  await symlink(f.ssot, path.join(f.dir, '.agents/skills'));
  const p = await planProject(f);
  assert.equal(p.ok, false);
  assert.match(p.problems[0].error, /parent is a symlink/);
});
test('external source symlinks and mismatched frontmatter fail closed', async (t) => {
  const f = await fixture(t);
  await symlink(path.join(f.ssot, 'dev/sample-skill'), path.join(f.ssot, 'sample-skill'));
  await assert.rejects(
    resolveManifest(f.manifestPath, {
      text: f.text.replace('dev/sample-skill', 'writing/writing-skill'),
    }),
    /name must equal/,
  );
  const external = path.join(f.base, 'external');
  await mkdir(external);
  await symlink(external, path.join(f.ssot, 'escape'));
  const scan = await scanSource(f.ssot);
  assert(scan.problems.some((p) => p.error.includes('escapes')));
});
test('duplicate names require an explicit path', async (t) => {
  const f = await fixture(t);
  await mkdir(path.join(f.ssot, 'other/sample-skill'), { recursive: true });
  await writeFile(
    path.join(f.ssot, 'other/sample-skill/SKILL.md'),
    '---\nname: sample-skill\ndescription: Duplicate\n---\n',
  );
  await assert.rejects(
    resolveManifest(f.manifestPath, { text: f.text.replace('    path: dev/sample-skill\n', '') }),
    /found 2/,
  );
});
