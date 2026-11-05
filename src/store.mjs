import path from 'node:path';
import os from 'node:os';
import { mkdir, readFile, open, rename, rm, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { exists } from './skills.mjs';

export const magpieConfig = () =>
  process.env.SKILL_WORKSPACES_MAGPIE_CONFIG ||
  path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'magpie');
export const defaultConfig = () =>
  process.env.SKILL_WORKSPACES_CONFIG || path.join(magpieConfig(), 'skill-workspaces');
export async function atomicWrite(file, text, mode = 0o600) {
  const temp = `${file}.tmp-${randomUUID()}`;
  let handle;
  try {
    handle = await open(temp, 'wx', mode);
    await handle.writeFile(text);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temp, file);
    const directory = await open(path.dirname(file), 'r');
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } finally {
    await handle?.close();
    await rm(temp, { force: true });
  }
}
export class Store {
  constructor(dir = defaultConfig()) {
    this.dir = path.resolve(dir);
    this.file = path.join(this.dir, 'state.json');
    this.journal = path.join(this.dir, 'transaction.json');
  }
  async load() {
    const info = await exists(this.file);
    if (!info)
      return {
        version: 1,
        sources: [],
        projects: [],
        inventories: {},
        lastSync: {},
        ignoreTargets: {},
      };
    if (!info.isFile() || info.isSymbolicLink())
      throw new Error('Plugin state must be a regular file');
    const state = JSON.parse(await readFile(this.file, 'utf8'));
    if (
      state.version !== 1 ||
      !Array.isArray(state.sources) ||
      !Array.isArray(state.projects) ||
      !state.inventories ||
      !state.lastSync
    )
      throw new Error('Unsupported or invalid plugin state');
    state.ignoreTargets ??= {};
    return state;
  }
  async save(state) {
    await atomicWrite(this.file, JSON.stringify(state, null, 2) + '\n');
  }
  async lock(fn) {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    this.dir = await realpath(this.dir);
    this.file = path.join(this.dir, 'state.json');
    this.journal = path.join(this.dir, 'transaction.json');
    const lock = path.join(this.dir, 'write.lock');
    try {
      await mkdir(lock);
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let pid;
      try {
        pid = JSON.parse(await readFile(path.join(lock, 'owner.json'), 'utf8')).pid;
      } catch {
        throw new Error(`Busy or interrupted lock: ${lock}; inspect it before removing it`);
      }
      let alive = true;
      try {
        process.kill(pid, 0);
      } catch (err) {
        if (err.code === 'ESRCH') alive = false;
      }
      if (alive)
        throw new Error('Another Skill Workspaces operation is running; retry when it finishes');
      const stale = lock + '-' + randomUUID();
      await rename(lock, stale);
      await rm(stale, { recursive: true });
      await mkdir(lock);
    }
    try {
      await atomicWrite(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid }));
      return await fn(await this.load());
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
  }
}
