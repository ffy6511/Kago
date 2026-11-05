import path from 'node:path';
import { readFile, realpath, stat } from 'node:fs/promises';
import { AGENTS, validName, inside, yaml, readSkill, scanSource, fingerprint } from './skills.mjs';

function object(value, keys, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${context} must be a mapping`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Unknown ${context} field: ${key}`);
}
function agents(value) {
  if (!Array.isArray(value) || value.some(a => typeof a !== 'string' || !Object.hasOwn(AGENTS,a)) || new Set(value).size !== value.length) throw new Error('agents must be a unique list of supported agent IDs');
  return value;
}
export function parseManifest(text) {
  const doc = yaml(text);
  object(doc, ['version','ssot','skills','defaults','deploy'], 'manifest');
  if (doc.version !== 1) throw new Error('Only manifest version 1 is supported');
  if (typeof doc.ssot !== 'string' || !doc.ssot.trim() || doc.ssot.includes('\0')) throw new Error('ssot must be a nonempty path');
  if (doc.defaults !== undefined) { object(doc.defaults,['agents'],'defaults'); if (doc.defaults.agents !== undefined) agents(doc.defaults.agents); }
  if (doc.deploy !== undefined) { object(doc.deploy,['method'],'deploy'); if (doc.deploy.method !== undefined && !['link','copy'].includes(doc.deploy.method)) throw new Error('deploy.method must be link or copy'); }
  if (!Array.isArray(doc.skills)) throw new Error('skills must be a list');
  const seen = new Set();
  for (const skill of doc.skills) {
    object(skill,['name','path','agents'],'skill');
    if (!validName(skill.name) || seen.has(skill.name)) throw new Error(`Invalid or duplicate skill name: ${skill.name}`);
    seen.add(skill.name);
    if (skill.path !== undefined && (typeof skill.path !== 'string' || !skill.path || path.isAbsolute(skill.path) || skill.path.includes('\0') || skill.path.split(/[\\/]/).includes('..') || skill.path.includes('\\'))) throw new Error(`Unsafe skill path: ${skill.path}`);
    if (skill.agents !== undefined) agents(skill.agents);
  }
  return {...doc, defaults: {agents:doc.defaults?.agents ?? ['cursor']}, deploy:{method:doc.deploy?.method ?? 'link'}};
}
export async function resolveManifest(manifestPath, {text, libraryRoot} = {}) {
  const file = path.resolve(manifestPath);
  const doc = parseManifest(text ?? await readFile(file,'utf8'));
  const ssot = await realpath(path.resolve(path.dirname(file), doc.ssot));
  let allowExternalLinks = false;
  if (libraryRoot) { try { allowExternalLinks = ssot === await realpath(libraryRoot); } catch { /* Library not installed */ } }
  let scanned;
  const skills = [];
  for (const entry of doc.skills) {
    let sourcePath = entry.path;
    if (sourcePath === undefined) {
      scanned ??= await scanSource(ssot,{allowExternalLinks});
      const matches = scanned.skills.filter(s => s.name === entry.name);
      if (matches.length !== 1) throw new Error(`Expected one source for ${entry.name}, found ${matches.length}; set path explicitly`);
      sourcePath = matches[0].path;
    }
    const lexical = path.resolve(ssot, sourcePath);
    if (!inside(ssot, lexical)) throw new Error(`Source escapes SSOT: ${entry.name}`);
    if (path.basename(lexical) !== entry.name) throw new Error(`Skill name must equal source folder: ${entry.name}`);
    const resolved = await realpath(lexical);
    if (!inside(ssot, resolved) && !allowExternalLinks) throw new Error(`Source symlink escapes SSOT: ${entry.name}`);
    if (!(await stat(resolved)).isDirectory()) throw new Error(`Source is not a directory: ${entry.name}`);
    const skill = await readSkill(lexical);
    skills.push({...entry, ...skill, source:resolved, agents:entry.agents ?? doc.defaults.agents, fingerprint:await fingerprint(resolved,{source:true})});
  }
  return {file, doc, ssot, skills};
}
