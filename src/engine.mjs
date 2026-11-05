import path from 'node:path';
import { mkdir, readFile, realpath, rename, rm, symlink, cp } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { stringify } from 'yaml';
import { Store, atomicWrite, magpieConfig } from './store.mjs';
import { exists, fingerprint, inside, scanSource, parseSkill, AGENTS } from './skills.mjs';
import { parseManifest } from './manifest.mjs';
import { planProject, projectRoot, checkParents } from './plan.mjs';
import { renderSkillDocument } from './skill-document.mjs';
import { skillFiles, skillFile, MAX_SKILL_TEXT } from './skill-files.mjs';

const BEGIN = '# >>> skill-workspaces: managed project skills >>>',
  END = '# <<< skill-workspaces <<<';
function ignoreContent(text, targets, previous) {
  const start = text.indexOf(BEGIN),
    end = text.indexOf(END);
  let base = text;
  if (start >= 0 || end >= 0) {
    if (
      start < 0 ||
      end < start ||
      text.indexOf(BEGIN, start + 1) >= 0 ||
      text.indexOf(END, end + 1) >= 0
    )
      throw new Error('Malformed Skill Workspaces .gitignore block; repair it before applying');
    const actual = text
      .slice(start + BEGIN.length, end)
      .trim()
      .split('\n')
      .filter(Boolean)
      .sort();
    const expected = Object.keys(previous)
      .sort()
      .map((r) => '/' + r);
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error(
        'Managed .gitignore block was edited; preserve or resolve it before applying',
      );
    base = text.slice(0, start) + text.slice(end + END.length).replace(/^\r?\n/, '');
  }
  return targets.length
    ? base +
        (base && !base.endsWith('\n') ? '\n' : '') +
        BEGIN +
        '\n' +
        targets
          .sort()
          .map((r) => '/' + r)
          .join('\n') +
        '\n' +
        END +
        '\n'
    : base;
}
async function ignoreInput(dir) {
  const file = path.join(dir, '.gitignore'),
    info = await exists(file);
  if (info && (!info.isFile() || info.isSymbolicLink()))
    throw new Error('.gitignore must be a regular file, not a symlink');
  return {
    file,
    text: info ? await readFile(file, 'utf8') : '',
    mode: info ? info.mode & 0o777 : 0o644,
  };
}
export class Engine {
  constructor({ configDir, magpieDir = magpieConfig() } = {}) {
    this.store = new Store(configDir);
    this.magpieDir = path.resolve(magpieDir);
    this.libraryRoot = path.join(this.magpieDir, 'library/skills');
  }
  async library() {
    let data = {};
    try {
      data = JSON.parse(await readFile(path.join(this.magpieDir, 'library.json'), 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT')
        return { dir: this.libraryRoot, projects: [], skills: [], error: e.message };
    }
    return {
      dir: this.libraryRoot,
      exists: !!(await exists(this.libraryRoot)),
      projects: (data.projects || []).map((p) => ({ dir: p.dir })),
      skills: (data.skills || []).map((s) => ({ name: s.name })),
    };
  }
  async scan(dir) {
    const resolved = await realpath(dir);
    let library;
    try {
      library = await realpath(this.libraryRoot);
    } catch {
      /* No Library */
    }
    return scanSource(resolved, { allowExternalLinks: resolved === library });
  }
  async resolveSkill(source, relative) {
    const scan = await this.scan(source);
    const skill = scan.skills.find((entry) => entry.path === relative);
    if (!skill) throw new Error('Choose a valid scanned skill');
    return skill;
  }
  async readSkillDocument(source, relative, file = 'SKILL.md') {
    const skill = await this.resolveSkill(source, relative);
    const document = await skillFile(skill.dir, file);
    return {
      name: skill.name,
      file,
      path: document.file,
      directory: skill.dir,
      files: await skillFiles(skill.dir),
      text: document.text,
      ...(/\.(md|markdown)$/i.test(file)
        ? renderSkillDocument(document.text)
        : { metadata: {}, html: null }),
    };
  }
  async saveSkillDocument(source, relative, file, text, expectedText) {
    if (
      typeof text !== 'string' ||
      typeof expectedText !== 'string' ||
      Buffer.byteLength(text) > MAX_SKILL_TEXT ||
      Buffer.byteLength(expectedText) > MAX_SKILL_TEXT ||
      text.includes('\0')
    )
      throw new Error('Expected UTF-8 text under 1 MiB');
    await this.store.lock(async () => {
      const skill = await this.resolveSkill(source, relative);
      const current = await skillFile(skill.dir, file);
      if (current.text !== expectedText)
        throw new Error('File changed outside this editor; reopen it before saving');
      if (file === 'SKILL.md') parseSkill(text, skill.name);
      await atomicWrite(current.file, text, current.info.mode & 0o777);
    });
    return this.readSkillDocument(source, relative, file);
  }
  async status() {
    const state = await this.store.load();
    return {
      ...state,
      agents: AGENTS,
      library: await this.library(),
      configDir: this.store.dir,
      pendingRecovery: !!(await exists(this.store.journal)),
    };
  }
  async registerSource(dir) {
    const source = await this.scan(dir);
    await this.store.lock(async (state) => {
      await this.recover(state);
      if (!state.sources.some((s) => s.dir === source.root))
        state.sources.push({ dir: source.root });
      await this.store.save(state);
    });
    return source;
  }
  async removeSource(dir) {
    return this.store.lock(async (state) => {
      await this.recover(state);
      state.sources = state.sources.filter((s) => s.dir !== dir);
      await this.store.save(state);
      return { ok: true };
    });
  }
  async manifestLocation(dir, file) {
    const target = path.resolve(dir, file || 'skills.manifest.yaml');
    if (
      !inside(dir, target) ||
      !/\.ya?ml$/.test(target) ||
      target.slice(dir.length).split(path.sep).includes('.git')
    )
      throw new Error('Manifest must be a YAML file inside the project, outside .git');
    let current = dir;
    for (const part of path.relative(dir, target).split(path.sep)) {
      current = path.join(current, part);
      const info = await exists(current);
      if (info?.isSymbolicLink()) throw new Error(`Manifest path is a symlink: ${current}`);
    }
    return target;
  }
  async registerProject(dir, manifestPath) {
    const root = await projectRoot(dir),
      file = await this.manifestLocation(root, manifestPath);
    return this.store.lock(async (state) => {
      await this.recover(state);
      let p = state.projects.find((p) => p.dir === root);
      if (p) p.manifestPath = file;
      else {
        p = { dir: root, manifestPath: file };
        state.projects.push(p);
      }
      await this.store.save(state);
      return p;
    });
  }
  async readManifest(dir) {
    const root = await projectRoot(dir),
      state = await this.store.load(),
      project = state.projects.find((p) => p.dir === root);
    const file = await this.manifestLocation(root, project?.manifestPath),
      present = !!(await exists(file));
    return { file, text: present ? await readFile(file, 'utf8') : '', exists: present };
  }
  async saveManifest(dir, text, { expectedText } = {}) {
    parseManifest(text);
    return this.store.lock(async (state) => {
      await this.recover(state);
      const root = await projectRoot(dir),
        project = state.projects.find((p) => p.dir === root);
      if (!project) throw new Error('Register the project before saving its manifest');
      const file = await this.manifestLocation(root, project.manifestPath),
        info = await exists(file);
      if (info && !info.isFile()) throw new Error('Manifest must be a regular file');
      const current = info ? await readFile(file, 'utf8') : '';
      if (expectedText === undefined && info)
        throw new Error('Read the current manifest before replacing it');
      if (expectedText !== undefined && current !== expectedText)
        throw new Error('Manifest changed on disk; reload before saving');
      await mkdir(path.dirname(file), { recursive: true });
      await atomicWrite(file, text, info ? info.mode & 0o777 : 0o644);
      return { ok: true, file };
    });
  }
  async plan(dir, { manifestPath, text, state } = {}) {
    const root = await projectRoot(dir);
    state ??= await this.store.load();
    const project = state.projects.find((p) => p.dir === root),
      inventory = state.inventories[root] || {};
    const file = await this.manifestLocation(root, manifestPath || project?.manifestPath);
    const plan = await planProject({
      dir: root,
      manifestPath: file,
      text,
      inventory,
      libraryRoot: this.libraryRoot,
    });
    try {
      const input = await ignoreInput(root);
      const expected = Object.fromEntries(
        (state.ignoreTargets[root] || Object.keys(inventory)).map((r) => [r, true]),
      );
      try {
        ignoreContent(input.text, Object.keys(inventory), expected);
      } catch (e) {
        ignoreContent(input.text, Object.keys(inventory), inventory);
      }
    } catch (e) {
      plan.problems.push({ relative: '.gitignore', error: e.message });
      plan.ok = false;
    }
    if (await exists(this.store.journal)) {
      plan.problems.push({
        relative: 'inventory',
        error: 'Interrupted operation needs recovery; run Apply to reconcile recorded outputs',
      });
      plan.ok = false;
    }
    return plan;
  }
  async recover(state) {
    if (!(await exists(this.store.journal))) return;
    const txn = JSON.parse(await readFile(this.store.journal, 'utf8'));
    const root = await projectRoot(txn.dir);
    await checkParents(root, txn.relative);
    for (const file of [txn.staging, txn.backup].filter(Boolean))
      if (
        path.dirname(file) !== path.dirname(path.join(root, txn.relative)) ||
        !path.basename(file).startsWith('.skill-workspaces-')
      )
        throw new Error('Unsafe recovery path');
    const target = path.join(root, txn.relative),
      current = await fingerprint(target);
    state.inventories[root] ??= {};
    if (current === txn.after?.fingerprint || (!current && !txn.after)) {
      if (txn.after) state.inventories[root][txn.relative] = txn.after;
      else delete state.inventories[root][txn.relative];
    } else if (current === txn.before?.fingerprint)
      state.inventories[root][txn.relative] = txn.before;
    else if (
      !current &&
      txn.backup &&
      (await fingerprint(txn.backup)) === txn.before?.fingerprint
    ) {
      await rename(txn.backup, target);
      state.inventories[root][txn.relative] = txn.before;
    } else if (!current && !txn.before) delete state.inventories[root][txn.relative];
    else if (!current && txn.before && (!txn.backup || !(await exists(txn.backup))))
      state.inventories[root][txn.relative] = txn.before;
    else
      throw new Error(
        'Interrupted target changed locally; resolve transaction.json without discarding user files',
      );
    await this.store.save(state);
    for (const [file, expected] of [
      [txn.staging, txn.after?.fingerprint],
      [txn.backup, txn.before?.fingerprint],
    ]) {
      if (file && (await exists(file))) {
        if ((await fingerprint(file)) !== expected)
          throw new Error(`Recovery artifact was edited; preserve it manually: ${file}`);
        await rm(file, { recursive: true, force: true });
      }
    }
    await rm(this.store.journal);
  }
  async execute(state, plan) {
    if (!plan.ok) return plan;
    const root = plan.dir,
      inventory = state.inventories[root] || {},
      oldInventory = Object.fromEntries(
        (state.ignoreTargets[root] || Object.keys(inventory)).map((r) => [r, true]),
      ),
      completed = [];
    const beforeIgnore = await ignoreInput(root);
    const finalTargets = plan.operations
      .filter((o) => !['remove', 'forget'].includes(o.action))
      .map((o) => o.relative);
    let afterIgnore;
    try {
      afterIgnore = ignoreContent(beforeIgnore.text, finalTargets, oldInventory);
    } catch {
      afterIgnore = ignoreContent(beforeIgnore.text, finalTargets, inventory);
    }
    state.inventories[root] ??= {};
    for (const op of plan.operations) {
      if (op.action === 'unchanged') {
        completed.push(op);
        continue;
      }
      await checkParents(root, op.relative);
      const target = path.join(root, op.relative);
      const expected = ['create', 'forget'].includes(op.action)
        ? null
        : (op.owned?.fingerprint ?? null);
      if ((await fingerprint(target)) !== expected)
        throw new Error(`Target changed after preview: ${op.relative}`);
      const id = randomUUID(),
        staging = path.join(path.dirname(target), `.skill-workspaces-${id}-new`),
        backup = path.join(path.dirname(target), `.skill-workspaces-${id}-old`);
      let after = null;
      if (['create', 'update'].includes(op.action)) {
        if ((await fingerprint(op.source, { source: true })) !== op.sourceFingerprint)
          throw new Error(`Source changed after preview: ${op.name}`);
        await mkdir(path.dirname(target), { recursive: true });
        await checkParents(root, op.relative);
        if (op.method === 'copy')
          await cp(op.source, staging, {
            recursive: true,
            dereference: false,
            errorOnExist: true,
            force: false,
          });
        else await symlink(path.relative(path.dirname(target), op.source), staging, 'dir');
        after = { source: op.source, method: op.method, fingerprint: await fingerprint(staging) };
        if (op.method === 'copy' && after.fingerprint !== op.sourceFingerprint) {
          await rm(staging, { recursive: true, force: true });
          throw new Error('Source changed during copy; retry');
        }
      }
      if ((await fingerprint(target)) !== expected) {
        if (after) await rm(staging, { recursive: true, force: true });
        throw new Error(`Target changed during staging: ${op.relative}`);
      }
      await checkParents(root, op.relative);
      await atomicWrite(
        this.store.journal,
        JSON.stringify({
          dir: root,
          relative: op.relative,
          before: op.owned || null,
          after,
          staging: after ? staging : null,
          backup: expected ? backup : null,
        }),
      );
      if (await exists(target)) await rename(target, backup);
      if (after) await rename(staging, target);
      if (after) state.inventories[root][op.relative] = after;
      else delete state.inventories[root][op.relative];
      await this.store.save(state);
      if (await exists(backup)) await rm(backup, { recursive: true });
      await rm(this.store.journal);
      completed.push(op);
    }
    const currentIgnore = await ignoreInput(root);
    if (currentIgnore.text !== beforeIgnore.text)
      throw new Error(
        '.gitignore changed during Apply; skill ownership is retained, retry after reviewing it',
      );
    if (afterIgnore !== beforeIgnore.text)
      await atomicWrite(beforeIgnore.file, afterIgnore, beforeIgnore.mode);
    state.ignoreTargets[root] = finalTargets;
    state.lastSync[root] = {
      time: new Date().toISOString(),
      ok: true,
      changed: completed.filter((o) => o.action !== 'unchanged').length,
    };
    await this.store.save(state);
    return { ...plan, completed: completed.length };
  }
  async apply(dir, options = {}) {
    return this.store.lock(async (state) => {
      await this.recover(state);
      const root = await projectRoot(dir),
        plan = await this.plan(root, { ...options, state });
      if (!plan.ok) return plan;
      try {
        return await this.execute(state, plan);
      } catch (e) {
        try {
          await this.recover(state);
        } catch (recovery) {
          e.message += `; recovery: ${recovery.message}`;
        }
        state.lastSync[root] = { time: new Date().toISOString(), ok: false, error: e.message };
        await this.store.save(state);
        throw e;
      }
    });
  }
  async syncAll() {
    const state = await this.store.load(),
      results = [];
    for (const p of state.projects) {
      try {
        results.push(await this.apply(p.dir));
      } catch (e) {
        results.push({ dir: p.dir, ok: false, error: e.message });
      }
    }
    return { ok: results.every((r) => r.ok), results };
  }
  async removeProject(dir, { keep = true } = {}) {
    return this.store.lock(async (state) => {
      await this.recover(state);
      const root =
          keep && state.projects.some((p) => p.dir === path.resolve(dir))
            ? path.resolve(dir)
            : await projectRoot(dir),
        inventory = state.inventories[root] || {};
      if (!keep) {
        const operations = [];
        for (const [relative, owned] of Object.entries(inventory)) {
          await checkParents(root, relative);
          const current = await fingerprint(path.join(root, relative));
          if (current && current !== owned.fingerprint)
            throw new Error(`Locally modified target will not be removed: ${relative}`);
          operations.push({ relative, owned, action: current ? 'remove' : 'forget' });
        }
        await this.execute(state, { dir: root, operations, ok: true, problems: [] });
      }
      state.projects = state.projects.filter((p) => p.dir !== root);
      delete state.inventories[root];
      delete state.lastSync[root];
      delete state.ignoreTargets[root];
      await this.store.save(state);
      return { ok: true, kept: keep };
    });
  }
  draft(source, skills, agents = ['cursor'], method = 'link') {
    return stringify({
      version: 1,
      ssot: source,
      defaults: { agents },
      deploy: { method },
      skills,
    });
  }
}
