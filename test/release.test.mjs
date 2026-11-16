import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { publishedVersion, verifyPublishedArtifact, verifyRelease } from '../scripts/release.mjs';

async function releaseFixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'kago-release-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Kago test');
  git('config', 'user.email', 'test@example.invalid');
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({ name: '@jhzhuo/kago', version: '1.2.3', publishConfig: { access: 'public' } }),
  );
  await mkdir(path.join(directory, 'docs/releases'), { recursive: true });
  await writeFile(
    path.join(directory, 'docs/releases/1.2.3.md'),
    'Release notes.\n\n## 中文\n\n发布说明。\n',
  );
  git('add', '--', 'package.json', 'docs/releases/1.2.3.md');
  git('commit', '-m', 'test fixture');
  git('tag', '-a', 'v1.2.3', '-m', '1.2.3');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  return { directory, git };
}

test('release accepts an annotated tag on main and rejects mismatched versions', async (t) => {
  const { directory, git } = await releaseFixture(t);
  assert.deepEqual(await verifyRelease('v1.2.3', directory), {
    name: '@jhzhuo/kago',
    version: '1.2.3',
  });
  git('tag', 'v1.2.4');
  await assert.rejects(verifyRelease('v1.2.4', directory), /does not match/);
  await assert.rejects(verifyRelease('v1.2.3-beta.1', directory), /vMAJOR.MINOR.PATCH/);
});

test('release rejects an unmerged tag and a checkout that differs from its tag', async (t) => {
  const { directory, git } = await releaseFixture(t);
  git('checkout', '-b', 'unmerged');
  await writeFile(path.join(directory, 'feature.txt'), 'Unmerged feature');
  git('add', '--', 'feature.txt');
  git('commit', '-m', 'unmerged feature');
  await assert.rejects(verifyRelease('v1.2.3', directory), /checkout must match/);
  git('tag', '-f', 'v1.2.3');
  await assert.rejects(verifyRelease('v1.2.3', directory), /reachable from origin\/main/);
});

test('release requires bilingual notes before publication', async (t) => {
  const { directory } = await releaseFixture(t);
  await writeFile(path.join(directory, 'docs/releases/1.2.3.md'), 'English only.');
  await assert.rejects(verifyRelease('v1.2.3', directory), /English and Chinese/);
});

test('registry failures stop publication while a missing version can be published', async () => {
  assert.equal(
    await publishedVersion('@jhzhuo/kago', '1.2.3', async () => new Response('', { status: 404 })),
    null,
  );
  for (const status of [401, 429, 500])
    await assert.rejects(
      publishedVersion('@jhzhuo/kago', '1.2.3', async () => new Response('', { status })),
      new RegExp(`HTTP ${status}`),
    );
  await assert.rejects(
    publishedVersion('@jhzhuo/kago', '1.2.3', async () => {
      throw new Error('Network unavailable');
    }),
    /Network unavailable/,
  );
});

test('release retries accept identical npm artifacts and reject different contents', () => {
  const packed = { integrity: 'sha512-example' };
  verifyPublishedArtifact({ dist: { integrity: packed.integrity } }, packed);
  assert.throws(
    () => verifyPublishedArtifact({ dist: { integrity: 'sha512-other' } }, packed),
    /different package contents/,
  );
});
