import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  readFile,
  writeFile,
  lstat,
  readlink,
  rm,
  symlink,
  cp,
  chmod,
  mkdir,
} from 'node:fs/promises';
import { fixture } from '../support/fixtures.mjs';
import { Engine } from '../src/engine.mjs';
import { fingerprint } from '../src/skills.mjs';
const setup = async (t) => {
  const f = await fixture(t);
  const e = new Engine({ configDir: path.join(f.base, 'config') });
  await e.registerProject(f.dir);
  return { ...f, e };
};
test('relative links are idempotent and cleanup is ownership based', async (t) => {
  const f = await setup(t);
  assert((await f.e.apply(f.dir)).ok);
  const target = path.join(f.dir, '.agents/skills/sample-skill');
  assert((await lstat(target)).isSymbolicLink());
  assert(!path.isAbsolute(await readlink(target)));
  assert((await f.e.plan(f.dir)).operations.every((o) => o.action === 'unchanged'));
  await writeFile(f.manifestPath, f.text.replace(/skills:\n[\s\S]*/, 'skills: []\n'));
  assert((await f.e.apply(f.dir)).ok);
  await assert.rejects(lstat(target), { code: 'ENOENT' });
  assert(!(await readFile(path.join(f.dir, '.gitignore'), 'utf8')).includes('sample-skill'));
});
test('copy mode updates sources but refuses locally edited copies', async (t) => {
  const f = await setup(t);
  await writeFile(f.manifestPath, f.text + 'deploy: {method: copy}\n');
  assert((await f.e.apply(f.dir)).ok);
  const source = path.join(f.ssot, 'dev/sample-skill/SKILL.md'),
    target = path.join(f.dir, '.agents/skills/sample-skill/SKILL.md');
  await writeFile(source, (await readFile(source, 'utf8')) + 'Updated\n');
  assert((await f.e.apply(f.dir)).ok);
  assert.equal(await readFile(target, 'utf8'), await readFile(source, 'utf8'));
  await writeFile(target, 'User edit');
  const plan = await f.e.apply(f.dir);
  assert(!plan.ok);
  assert.match(plan.problems[0].error, /edited/);
  assert.equal(await readFile(target, 'utf8'), 'User edit');
});
test('replaced managed links are never deleted', async (t) => {
  const f = await setup(t);
  await f.e.apply(f.dir);
  const target = path.join(f.dir, '.agents/skills/sample-skill');
  await rm(target);
  await symlink(f.base, target);
  await assert.rejects(f.e.removeProject(f.dir, { keep: false }), /modified/);
  assert.equal(await readlink(target), f.base);
});
test('keep=true relinquishes ownership and preserves outputs', async (t) => {
  const f = await setup(t);
  await f.e.apply(f.dir);
  await f.e.removeProject(f.dir, { keep: true });
  assert((await lstat(path.join(f.dir, '.agents/skills/sample-skill'))).isSymbolicLink());
  const state = await f.e.status();
  assert.equal(state.projects.length, 0);
  assert.equal(Object.keys(state.inventories).length, 0);
});
test('symlinked gitignore blocks the entire apply', async (t) => {
  const f = await setup(t);
  await symlink(f.manifestPath, path.join(f.dir, '.gitignore'));
  const p = await f.e.apply(f.dir);
  assert(!p.ok);
  await assert.rejects(lstat(path.join(f.dir, '.agents')), { code: 'ENOENT' });
});
test('manifest saving detects outside changes and path symlinks', async (t) => {
  const f = await setup(t);
  await assert.rejects(f.e.saveManifest(f.dir, f.text, { expectedText: 'old' }), /changed on disk/);
  await f.e.saveManifest(f.dir, f.text, { expectedText: f.text });
  await assert.rejects(f.e.registerProject(f.dir, '../external.yaml'), /inside/);
});
test('apply persists the current manifest draft before deploying it', async (t) => {
  const f = await setup(t),
    draft = f.text + 'deploy: {method: copy}\n';
  assert((await f.e.apply(f.dir, { manifestText: draft, expectedText: f.text })).ok);
  assert.equal(await readFile(f.manifestPath, 'utf8'), draft);
  const target = path.join(f.dir, '.agents/skills/sample-skill');
  assert((await lstat(target)).isDirectory());
  assert.equal((await lstat(target)).isSymbolicLink(), false);
});
test('apply rejects a stale manifest baseline without writing or deploying', async (t) => {
  const f = await setup(t),
    draft = f.text.replace('agents: [cursor, codex, claude]', 'agents: [cursor]');
  await assert.rejects(
    f.e.apply(f.dir, { manifestText: draft, expectedText: 'stale manifest' }),
    /changed on disk/,
  );
  assert.equal(await readFile(f.manifestPath, 'utf8'), f.text);
  await assert.rejects(lstat(path.join(f.dir, '.agents/skills/sample-skill')), {
    code: 'ENOENT',
  });
});
test('a deployment conflict leaves the manifest draft untouched', async (t) => {
  const f = await setup(t);
  assert((await f.e.apply(f.dir)).ok);
  const target = path.join(f.dir, '.agents/skills/sample-skill'),
    draft = f.text.replace('agents: [cursor, codex, claude]', 'agents: [cursor]');
  await rm(target);
  await mkdir(target);
  const result = await f.e.apply(f.dir, { manifestText: draft, expectedText: f.text });
  assert.equal(result.ok, false);
  assert.equal(await readFile(f.manifestPath, 'utf8'), f.text);
});
test('apply can create a project manifest from the current draft', async (t) => {
  const f = await setup(t);
  await rm(f.manifestPath);
  assert((await f.e.apply(f.dir, { manifestText: f.text, expectedText: '' })).ok);
  assert.equal(await readFile(f.manifestPath, 'utf8'), f.text);
  assert((await lstat(path.join(f.dir, '.agents/skills/sample-skill'))).isSymbolicLink());
});
test('missing owned outputs can be recreated or forgotten', async (t) => {
  const f = await setup(t);
  await f.e.apply(f.dir);
  const target = path.join(f.dir, '.agents/skills/sample-skill');
  await rm(target);
  assert((await f.e.apply(f.dir)).ok);
  assert((await lstat(target)).isSymbolicLink());
  await rm(target);
  await writeFile(f.manifestPath, f.text.replace(/skills:\n[\s\S]*/, 'skills: []\n'));
  assert((await f.e.apply(f.dir)).ok);
});
test('interrupted placement keeps ownership and can resume', async (t) => {
  const f = await setup(t);
  const save = f.e.store.save.bind(f.e.store);
  let failed = false;
  f.e.store.save = async (state) => {
    if (!failed && Object.keys(state.inventories[f.dir] || {}).length) {
      failed = true;
      throw new Error('Injected checkpoint failure');
    }
    return save(state);
  };
  await assert.rejects(f.e.apply(f.dir), /Injected/);
  assert(failed);
  assert((await f.e.apply(f.dir)).ok);
  assert((await f.e.plan(f.dir)).operations.every((o) => o.action === 'unchanged'));
});
test('a conflict prevents all planned placements', async (t) => {
  const f = await setup(t);
  await f.e.apply(f.dir);
  await f.e.removeProject(f.dir, { keep: true });
  const p = await f.e.apply(f.dir);
  assert(!p.ok);
  assert(p.operations.every((o) => o.action === 'conflict'));
});
test('cross-process lock prevents concurrent mutation', async (t) => {
  const f = await setup(t);
  await f.e.store.lock(async () => {
    await assert.rejects(f.e.registerProject(f.dir), /Another Skill Workspaces operation/);
  });
});
test('a missing project can be unregistered without touching its files', async (t) => {
  const f = await setup(t);
  await rm(f.dir, { recursive: true });
  assert((await f.e.removeProject(f.dir, { keep: true })).kept);
  assert.equal((await f.e.status()).projects.length, 0);
});

test('an exact replacement is adopted instead of conflicting', async (t) => {
  const f = await setup(t);
  assert((await f.e.apply(f.dir)).ok);
  const shifted = path.join(f.base, 'skills-next');
  await cp(f.ssot, shifted, { recursive: true });
  await writeFile(f.manifestPath, f.text.replace('ssot: ../skills', 'ssot: ../skills-next'));
  const target = path.join(f.dir, '.agents/skills/sample-skill');
  await rm(target);
  await symlink('../../../skills-next/dev/sample-skill', target);
  const plan = await f.e.plan(f.dir);
  assert(plan.ok);
  assert.equal(plan.operations[0].action, 'unchanged');
  assert.equal(plan.operations[0].adopted, true);
  assert((await f.e.apply(f.dir)).ok);
  const state = await f.e.status();
  assert.equal(
    state.inventories[f.dir]['.agents/skills/sample-skill'].fingerprint,
    await fingerprint(target),
  );
  const clean = await f.e.plan(f.dir);
  assert(clean.operations.every((o) => o.action === 'unchanged' && !o.adopted));
});
test('a changed link reports both recorded and current targets', async (t) => {
  const f = await setup(t);
  await f.e.apply(f.dir);
  const target = path.join(f.dir, '.agents/skills/sample-skill');
  await rm(target);
  await symlink(f.ssot, target);
  const plan = await f.e.plan(f.dir);
  assert(!plan.ok);
  assert.match(plan.problems[0].error, /points to/);
  assert.equal(plan.problems[0].conflict.kind, 'link-target');
  assert.match(plan.problems[0].conflict.expected, /skills\/dev\/sample-skill$/);
  assert.equal(plan.problems[0].conflict.actual, f.ssot);
});
test('copy permission drift is reported apart from content edits', async (t) => {
  const f = await setup(t);
  await writeFile(f.manifestPath, f.text + 'deploy: {method: copy}\n');
  assert((await f.e.apply(f.dir)).ok);
  const target = path.join(f.dir, '.agents/skills/sample-skill/SKILL.md');
  await chmod(target, 0o600);
  let plan = await f.e.plan(f.dir);
  assert(!plan.ok);
  assert.equal(plan.problems[0].conflict.kind, 'copy-modes');
  await writeFile(target, 'User edit');
  plan = await f.e.plan(f.dir);
  assert.equal(plan.problems[0].conflict.kind, 'copy-content');
});
test('re-registering without a manifest path keeps the current one', async (t) => {
  const f = await setup(t);
  await f.e.registerProject(f.dir, 'docs.yaml');
  assert.equal((await f.e.status()).projects[0].manifestPath, path.join(f.dir, 'docs.yaml'));
  await f.e.registerProject(f.dir);
  assert.equal((await f.e.status()).projects[0].manifestPath, path.join(f.dir, 'docs.yaml'));
});

test('repairing a linked skills folder preserves its target', async (t) => {
  const f = await setup(t);
  await mkdir(path.join(f.dir, '.agents'), { recursive: true });
  await symlink(f.ssot, path.join(f.dir, '.agents/skills'));
  const plan = await f.e.plan(f.dir);
  assert(!plan.ok);
  const detail = plan.problems[0].conflict;
  assert.equal(detail.kind, 'parent-symlink');
  assert.equal(detail.relative, '.agents/skills');
  assert.equal(detail.fixable, true);
  assert.equal(detail.resolved, f.ssot);
  const fixed = await f.e.repairParent(f.dir, '.agents/skills');
  assert.equal(fixed.ok, true);
  const info = await lstat(path.join(f.dir, '.agents/skills'));
  assert(info.isDirectory());
  assert.equal(info.isSymbolicLink(), false);
  assert.match(await readFile(path.join(f.ssot, 'dev/sample-skill/SKILL.md'), 'utf8'), /Body/);
  const after = await f.e.plan(f.dir);
  assert(after.ok);
  assert(after.operations.every((o) => o.action === 'create'));
});
test('repair only accepts real links inside per-agent skills folders', async (t) => {
  const f = await setup(t);
  await mkdir(path.join(f.dir, '.agents'), { recursive: true });
  await symlink(f.ssot, path.join(f.dir, '.agents/skills'));
  await assert.rejects(f.e.repairParent(f.dir, '.agents'), /deployment skills folder/);
  await assert.rejects(f.e.repairParent(f.dir, '../../outside'), /deployment skills folder/);
  assert((await f.e.repairParent(f.dir, '.agents/skills')).ok);
  await assert.rejects(f.e.repairParent(f.dir, '.agents/skills'), /no longer a symlink/);
});
test('a linked higher parent is reported without offering a repair', async (t) => {
  const f = await setup(t);
  await symlink(f.ssot, path.join(f.dir, '.agents'));
  const plan = await f.e.plan(f.dir);
  const detail = plan.problems[0].conflict;
  assert.equal(detail.kind, 'parent-symlink');
  assert.equal(detail.relative, '.agents');
  assert.equal(detail.fixable, false);
});
