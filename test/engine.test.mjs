import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, writeFile, lstat, readlink, rm, symlink } from 'node:fs/promises';
import { fixture } from '../support/fixtures.mjs';
import { Engine } from '../src/engine.mjs';
const setup=async t=>{const f=await fixture(t);const e=new Engine({configDir:path.join(f.base,'config')});await e.registerProject(f.dir);return {...f,e};};
test('relative links are idempotent and cleanup is ownership based',async t=>{
  const f=await setup(t);assert((await f.e.apply(f.dir)).ok);
  const target=path.join(f.dir,'.agents/skills/sample-skill');
  assert((await lstat(target)).isSymbolicLink());assert(!path.isAbsolute(await readlink(target)));
  assert((await f.e.plan(f.dir)).operations.every(o=>o.action==='unchanged'));
  await writeFile(f.manifestPath,f.text.replace(/skills:\n[\s\S]*/,'skills: []\n'));
  assert((await f.e.apply(f.dir)).ok);await assert.rejects(lstat(target),{code:'ENOENT'});
  assert(!(await readFile(path.join(f.dir,'.gitignore'),'utf8')).includes('sample-skill'));
});
test('copy mode updates sources but refuses locally edited copies',async t=>{
  const f=await setup(t);await writeFile(f.manifestPath,f.text+'deploy: {method: copy}\n');assert((await f.e.apply(f.dir)).ok);
  const source=path.join(f.ssot,'dev/sample-skill/SKILL.md'),target=path.join(f.dir,'.agents/skills/sample-skill/SKILL.md');
  await writeFile(source,(await readFile(source,'utf8'))+'Updated\n');assert((await f.e.apply(f.dir)).ok);assert.equal(await readFile(target,'utf8'),await readFile(source,'utf8'));
  await writeFile(target,'User edit');const plan=await f.e.apply(f.dir);assert(!plan.ok);assert.match(plan.problems[0].error,/edited/);assert.equal(await readFile(target,'utf8'),'User edit');
});
test('replaced managed links are never deleted',async t=>{
  const f=await setup(t);await f.e.apply(f.dir);const target=path.join(f.dir,'.agents/skills/sample-skill');await rm(target);await symlink(f.base,target);
  await assert.rejects(f.e.removeProject(f.dir,{keep:false}),/modified/);assert.equal(await readlink(target),f.base);
});
test('keep=true relinquishes ownership and preserves outputs',async t=>{
  const f=await setup(t);await f.e.apply(f.dir);await f.e.removeProject(f.dir,{keep:true});assert((await lstat(path.join(f.dir,'.agents/skills/sample-skill'))).isSymbolicLink());
  const state=await f.e.status();assert.equal(state.projects.length,0);assert.equal(Object.keys(state.inventories).length,0);
});
test('symlinked gitignore blocks the entire apply',async t=>{
  const f=await setup(t);await symlink(f.manifestPath,path.join(f.dir,'.gitignore'));const p=await f.e.apply(f.dir);assert(!p.ok);await assert.rejects(lstat(path.join(f.dir,'.agents')),{code:'ENOENT'});
});
test('manifest saving detects outside changes and path symlinks',async t=>{
  const f=await setup(t);await assert.rejects(f.e.saveManifest(f.dir,f.text,{expectedText:'old'}),/changed on disk/);await f.e.saveManifest(f.dir,f.text,{expectedText:f.text});await assert.rejects(f.e.registerProject(f.dir,'../external.yaml'),/inside/);
});
test('missing owned outputs can be recreated or forgotten',async t=>{
  const f=await setup(t);await f.e.apply(f.dir);const target=path.join(f.dir,'.agents/skills/sample-skill');await rm(target);
  assert((await f.e.apply(f.dir)).ok);assert((await lstat(target)).isSymbolicLink());
  await rm(target);await writeFile(f.manifestPath,f.text.replace(/skills:\n[\s\S]*/,'skills: []\n'));assert((await f.e.apply(f.dir)).ok);
});
test('interrupted placement keeps ownership and can resume',async t=>{
  const f=await setup(t);const save=f.e.store.save.bind(f.e.store);let failed=false;
  f.e.store.save=async state=>{if(!failed && Object.keys(state.inventories[f.dir] || {}).length){failed=true;throw new Error('Injected checkpoint failure');}return save(state);};
  await assert.rejects(f.e.apply(f.dir),/Injected/);assert(failed);assert((await f.e.apply(f.dir)).ok);assert((await f.e.plan(f.dir)).operations.every(o=>o.action==='unchanged'));
});
test('a conflict prevents all planned placements',async t=>{
  const f=await setup(t);await f.e.apply(f.dir);await f.e.removeProject(f.dir,{keep:true});
  const p=await f.e.apply(f.dir);assert(!p.ok);assert(p.operations.every(o=>o.action==='conflict'));
});
test('cross-process lock prevents concurrent mutation',async t=>{
  const f=await setup(t);await f.e.store.lock(async()=>{await assert.rejects(f.e.registerProject(f.dir),/Another Skill Workspaces operation/);});
});
