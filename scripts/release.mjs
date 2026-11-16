import { execFileSync } from 'node:child_process';
import { appendFile, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const registry = 'https://registry.npmjs.org/';

export async function verifyRelease(tag, directory = process.cwd()) {
  const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag || '');
  if (!match) throw new Error('Release tags must use vMAJOR.MINOR.PATCH');
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  const version = tag.slice(1);
  if (pkg.version !== version)
    throw new Error(`Tag ${tag} does not match package.json version ${pkg.version}`);
  if (pkg.name !== '@jhzhuo/kago' || pkg.publishConfig?.access !== 'public')
    throw new Error('Expected the public @jhzhuo/kago package');

  const git = (...args) =>
    execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  if (git('rev-parse', `${tag}^{commit}`) !== git('rev-parse', 'HEAD'))
    throw new Error('The checkout must match the release tag');
  try {
    git('merge-base', '--is-ancestor', 'HEAD', 'refs/remotes/origin/main');
  } catch {
    throw new Error('The release commit must be reachable from origin/main');
  }

  const notes = await readFile(path.join(directory, 'docs/releases', `${version}.md`), 'utf8');
  if (!notes.trim() || !/^## 中文\s*$/m.test(notes))
    throw new Error(`docs/releases/${version}.md must contain English and Chinese release notes`);
  return { name: pkg.name, version };
}

export async function publishedVersion(name, version, request = fetch) {
  const response = await request(`${registry}${encodeURIComponent(name)}/${version}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`npm registry lookup failed: HTTP ${response.status}`);
  return response.json();
}

export function verifyPublishedArtifact(published, packed) {
  if (published.dist?.integrity !== packed.integrity)
    throw new Error('This npm version already exists with different package contents');
}

export async function publishRelease(tag) {
  const { name, version } = await verifyRelease(tag);
  const destination = await mkdtemp(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'kago-'));
  const [packed] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', destination], {
      encoding: 'utf8',
    }),
  );
  const archive = path.join(destination, packed.filename);
  const existing = await publishedVersion(name, version);
  if (existing) {
    verifyPublishedArtifact(existing, packed);
    console.log(`${name}@${version} already contains this artifact; continuing GitHub Release`);
  } else {
    execFileSync(
      'npm',
      ['publish', archive, '--access', 'public', '--provenance', `--registry=${registry}`],
      { stdio: 'inherit' },
    );
  }
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `version=${version}\narchive=${archive}\n`);
  return { version, archive };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [, , command, tag] = process.argv;
  try {
    if (command === 'verify') console.log(await verifyRelease(tag));
    else if (command === 'publish') await publishRelease(tag);
    else throw new Error('Usage: node scripts/release.mjs verify|publish vMAJOR.MINOR.PATCH');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
