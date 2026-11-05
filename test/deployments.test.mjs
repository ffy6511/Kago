import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, symlink, readlink, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { Engine } from '../src/engine.mjs';
import { fixture } from '../support/fixtures.mjs';

test('detects relative and chained links by resolved source, without adopting or writing', async (t) => {
  const f = await fixture(t),
    configDir = path.join(f.base, 'config'),
    engine = new Engine({ configDir });
  await mkdir(path.join(f.dir, '.agents/skills'), { recursive: true });
  await mkdir(path.join(f.dir, '.claude/skills'), { recursive: true });
  await symlink(
    '../../../skills/dev/sample-skill',
    path.join(f.dir, '.agents/skills/sample-skill'),
  );
  await symlink(
    '../../.agents/skills/sample-skill',
    path.join(f.dir, '.claude/skills/sample-skill'),
  );
  const before = await readdir(f.dir),
    manifest = await readFile(f.manifestPath, 'utf8');
  const result = await engine.deployments(f.dir, f.ssot);
  assert.equal(result.skills.length, 1);
  assert.deepEqual(
    result.skills[0].targets.map((x) => x.relative),
    ['.agents/skills/sample-skill', '.claude/skills/sample-skill'],
  );
  assert(result.skills[0].targets.every((x) => !x.managed && x.method === 'link'));
  assert.deepEqual(await readdir(f.dir), before);
  assert.equal(await readFile(f.manifestPath, 'utf8'), manifest);
  await assert.rejects(readFile(path.join(configDir, 'state.json')), { code: 'ENOENT' });
});
test('whole-directory links are detected read-only while synchronization remains blocked', async (t) => {
  const f = await fixture(t),
    engine = new Engine({ configDir: path.join(f.base, 'config') });
  await mkdir(path.join(f.dir, '.agents'));
  await symlink(path.join(f.ssot, 'dev'), path.join(f.dir, '.agents/skills'));
  const result = await engine.deployments(f.dir, f.ssot);
  assert.equal(result.skills[0].targets[0].parentLinked, true);
  assert.equal(result.skills[0].targets[0].managed, false);
  assert.equal((await engine.plan(f.dir)).ok, false);
  assert.equal(await readlink(path.join(f.dir, '.agents/skills')), path.join(f.ssot, 'dev'));
});
test('same-named links to another skill and broken links never count as existing', async (t) => {
  const f = await fixture(t),
    engine = new Engine({ configDir: path.join(f.base, 'config') });
  await mkdir(path.join(f.dir, '.agents/skills'), { recursive: true });
  await symlink(
    path.join(f.ssot, 'writing/writing-skill'),
    path.join(f.dir, '.agents/skills/sample-skill'),
  );
  await symlink(path.join(f.base, 'missing'), path.join(f.dir, '.agents/skills/writing-skill'));
  const result = await engine.deployments(f.dir, f.ssot);
  assert.deepEqual(result.skills, []);
  assert.deepEqual(result.problems, []);
});
test('distinguishes managed links from replacements that still point at the same source', async (t) => {
  const f = await fixture(t),
    engine = new Engine({ configDir: path.join(f.base, 'config') });
  await engine.registerProject(f.dir);
  assert.equal((await engine.apply(f.dir)).ok, true);
  assert((await engine.deployments(f.dir, f.ssot)).skills[0].targets.every((x) => x.managed));
  const target = path.join(f.dir, '.agents/skills/sample-skill');
  await rm(target);
  await symlink(path.join(f.ssot, 'dev/sample-skill'), target);
  const result = await engine.deployments(f.dir, f.ssot);
  assert.equal(
    result.skills[0].targets.find((x) => x.relative.startsWith('.agents')).managed,
    false,
  );
  assert.equal((await engine.plan(f.dir)).ok, false);
});
test('owned copies count as existing only while their recorded fingerprint matches', async (t) => {
  const f = await fixture(t),
    engine = new Engine({ configDir: path.join(f.base, 'config') });
  await writeFile(f.manifestPath, f.text + 'deploy: {method: copy}\n');
  await engine.registerProject(f.dir);
  assert.equal((await engine.apply(f.dir)).ok, true);
  const result = await engine.deployments(f.dir, f.ssot);
  assert(result.skills[0].targets.every((x) => x.managed && x.method === 'copy'));
  await writeFile(path.join(f.dir, '.agents/skills/sample-skill/SKILL.md'), 'local edit\n');
  const updated = await engine.deployments(f.dir, f.ssot);
  assert.deepEqual(
    updated.skills[0].targets.map((x) => x.relative),
    ['.claude/skills/sample-skill'],
  );
});
test('an owned deployment remains observable after a saved removal request until Apply', async (t) => {
  const f = await fixture(t),
    engine = new Engine({ configDir: path.join(f.base, 'config') });
  await engine.registerProject(f.dir);
  await engine.apply(f.dir);
  await engine.saveManifest(f.dir, engine.draft(f.ssot, [], ['cursor'], 'link'), {
    expectedText: f.text,
  });
  assert.equal((await engine.deployments(f.dir, f.ssot)).skills.length, 1);
  assert((await engine.plan(f.dir)).operations.every((x) => x.action === 'remove'));
  await engine.apply(f.dir);
  assert.deepEqual((await engine.deployments(f.dir, f.ssot)).skills, []);
});
