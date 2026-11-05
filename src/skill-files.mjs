import path from 'node:path';
import { readdir, lstat, readFile, realpath } from 'node:fs/promises';
import { inside } from './skills.mjs';

export const MAX_SKILL_TEXT = 1024 * 1024;
export async function skillFiles(root) {
  const files = [];
  async function walk(dir, prefix = '', depth = 0) {
    if (depth > 12) return;
    for (const item of await readdir(dir, { withFileTypes: true })) {
      if (item.name.startsWith('.') || item.name === 'node_modules' || item.name.includes('\\'))
        continue;
      const relative = prefix + item.name,
        file = path.join(dir, item.name);
      if (item.isDirectory()) await walk(file, relative + '/', depth + 1);
      else if (item.isFile() && (await lstat(file)).size <= MAX_SKILL_TEXT) files.push(relative);
      if (files.length > 512) throw new Error('Skill contains too many preview files');
    }
  }
  await walk(root);
  return files.sort((a, b) => (a === 'SKILL.md' ? -1 : b === 'SKILL.md' ? 1 : a.localeCompare(b)));
}
export async function skillFile(root, relative = 'SKILL.md') {
  if (
    typeof relative !== 'string' ||
    !relative ||
    relative.includes('\\') ||
    relative.includes('\0') ||
    path.isAbsolute(relative)
  )
    throw new Error('Invalid skill file path');
  const parts = relative.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || p.startsWith('.') || p === 'node_modules'))
    throw new Error('Invalid skill file path');
  let file = root,
    info;
  for (const [index, part] of parts.entries()) {
    file = path.join(file, part);
    info = await lstat(file);
    if (info.isSymbolicLink() || (index < parts.length - 1 && !info.isDirectory()))
      throw new Error('Skill files cannot traverse symlinks');
  }
  if (!info.isFile() || info.size > MAX_SKILL_TEXT || !inside(root, await realpath(file)))
    throw new Error('Choose a regular skill file under 1 MiB');
  const bytes = await readFile(file);
  if (bytes.length > MAX_SKILL_TEXT || bytes.includes(0))
    throw new Error('Only UTF-8 text files under 1 MiB can be read or edited');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error('Only UTF-8 text files can be read or edited');
  }
  return { file, info, text };
}
