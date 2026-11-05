import { lstat, stat, readdir, readFile, realpath, readlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';

export const AGENTS = Object.freeze({
  cursor: '.agents/skills',
  codex: '.agents/skills',
  opencode: '.agents/skills',
  gemini: '.agents/skills',
  claude: '.claude/skills',
  pi: '.agents/skills',
  copilot: '.agents/skills',
  agy: '.agents/skills',
  kimi: '.agents/skills',
  goose: '.agents/skills',
  grok: '.agents/skills',
  droid: '.agents/skills',
  cline: '.agents/skills',
  dsh: '.agents/skills',
  qoder: '.qoder/skills',
  'qoder-cn': '.qoder/skills',
  codebuddy: '.codebuddy/skills',
  commandcode: '.commandcode/skills',
});
export const validName = (name) =>
  typeof name === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(name);
export const inside = (root, candidate) =>
  candidate === root ||
  (!path.relative(root, candidate).startsWith('..' + path.sep) &&
    path.relative(root, candidate) !== '..' &&
    !path.isAbsolute(path.relative(root, candidate)));
export async function exists(file) {
  try {
    return await lstat(file);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}
export function yaml(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 1024 * 1024)
    throw new Error('YAML exceeds 1 MiB or is not text');
  const doc = parseDocument(text, { uniqueKeys: true });
  if (doc.errors.length) throw new Error(doc.errors.map((e) => e.message).join('; '));
  return doc.toJS({ maxAliasCount: 0 });
}
export async function readSkill(dir) {
  const name = path.basename(dir);
  if (!validName(name)) throw new Error(`Invalid skill directory name: ${name}`);
  const file = path.join(dir, 'SKILL.md');
  const info = await lstat(file);
  if (!info.isFile() || info.size > 1024 * 1024)
    throw new Error(`SKILL.md must be a regular file under 1 MiB: ${dir}`);
  const text = await readFile(file, 'utf8');
  const match = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`Missing YAML frontmatter: ${name}`);
  const meta = yaml(match[1]);
  if (meta?.name !== name)
    throw new Error(`Frontmatter name must equal directory name: ${name} (got ${meta?.name})`);
  if (typeof meta.description !== 'string' || !meta.description.trim())
    throw new Error(`Missing skill description: ${name}`);
  return { name, description: meta.description.trim() };
}
export async function scanSource(source, { allowExternalLinks = false } = {}) {
  const root = await realpath(source);
  if (!(await stat(root)).isDirectory()) throw new Error('Source must be a directory');
  const skills = [],
    problems = [],
    visited = new Set();
  async function walk(dir, relative, depth) {
    if (depth > 12) {
      problems.push({ path: relative, error: 'Source nesting exceeds 12 levels' });
      return;
    }
    const resolved = await realpath(dir);
    if (!inside(root, resolved) && !allowExternalLinks) {
      problems.push({ path: relative, error: 'Symlink escapes source root' });
      return;
    }
    if (visited.has(resolved)) return;
    visited.add(resolved);
    if (await exists(path.join(dir, 'SKILL.md'))) {
      try {
        const skill = await readSkill(dir);
        skills.push({
          ...skill,
          path: relative || '.',
          category:
            path.dirname(relative || '.') === '.' ? 'Uncategorized' : path.dirname(relative),
          dir: resolved,
        });
      } catch (e) {
        problems.push({ path: relative, error: e.message });
      }
      return;
    }
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const child = path.join(dir, entry.name);
      try {
        if ((await stat(child)).isDirectory())
          await walk(child, path.join(relative, entry.name), depth + 1);
      } catch (e) {
        problems.push({ path: path.join(relative, entry.name), error: e.message });
      }
    }
  }
  await walk(root, '', 0);
  const counts = new Map();
  for (const s of skills) counts.set(s.name, (counts.get(s.name) || 0) + 1);
  for (const s of skills)
    if (counts.get(s.name) > 1)
      problems.push({
        path: s.path,
        error: `Duplicate skill name: ${s.name}; choose an explicit path`,
      });
  return { root, skills, problems };
}

// Hash link text without following it, so replaced links and local copy edits are detectable.
export async function fingerprint(file, { source = false } = {}) {
  const info = await exists(file);
  if (!info) return null;
  const hash = createHash('sha256');
  async function walk(current, relative, depth) {
    if (depth > 64) throw new Error('Skill tree exceeds 64 levels');
    const s = await lstat(current);
    if (s.isSymbolicLink()) {
      if (source) throw new Error(`Nested source symlinks are not supported: ${relative}`);
      hash.update(JSON.stringify(['link', relative, await readlink(current)]));
    } else if (s.isDirectory()) {
      hash.update(JSON.stringify(['dir', relative, s.mode & 0o777]));
      for (const name of (await readdir(current)).sort())
        await walk(path.join(current, name), path.join(relative, name), depth + 1);
    } else if (s.isFile()) {
      hash.update(JSON.stringify(['file', relative, s.mode & 0o777, s.size]));
      hash.update(await readFile(current));
    } else throw new Error(`Unsupported special file: ${relative}`);
  }
  await walk(file, '', 0);
  return hash.digest('hex');
}
