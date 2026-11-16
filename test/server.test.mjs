import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fixture } from '../support/fixtures.mjs';
import { startServer } from '../src/server.mjs';

test('HTTP service enforces token, Host, Origin and body limits', async (t) => {
  const f = await fixture(t),
    s = await startServer({ port: 0, configDir: path.join(f.base, 'config') });
  t.after(() => s.close());
  const htmlResponse = await fetch(s.url),
    html = await htmlResponse.text(),
    token = html.match(/name="page-token" content="([^"]+)"/)[1];
  assert.equal(htmlResponse.headers.get('access-control-allow-origin'), null);
  const asset = await fetch(s.url + 'vendor/magpie/cursor.svg', { headers: { Origin: 'null' } });
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('content-type'), 'image/svg+xml');
  assert.equal(asset.headers.get('access-control-allow-origin'), 'null');
  assert.equal((await fetch(s.url + 'vendor/magpie/unknown.svg')).status, 404);
  const opaqueHTML = await fetch(s.url, { headers: { Origin: 'null' } });
  assert.equal(opaqueHTML.headers.get('access-control-allow-origin'), null);
  assert.equal((await fetch(s.url + 'api/state')).status, 403);
  const hostStatus = await new Promise((resolve, reject) => {
    const req = http.get(s.url, { headers: { Host: 'attacker.example' } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
  });
  assert.equal(hostStatus, 403);
  const headers = { 'x-skill-workspaces-token': token, 'content-type': 'application/json' };
  const { version } = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );
  const health = await fetch(s.url + 'api/health', { headers });
  assert.deepEqual(await health.json(), { ok: true, version });
  assert.equal(
    (
      await fetch(s.url + 'api/state', {
        headers: { ...headers, Origin: 'https://attacker.example' },
      })
    ).status,
    403,
  );
  const reader = await fetch(s.url + 'api/skill/read', {
    method: 'POST',
    headers: { ...headers, Origin: 'null' },
    body: JSON.stringify({ source: f.ssot, path: 'dev/sample-skill' }),
  });
  assert.equal(reader.status, 200);
  assert.match((await reader.json()).html, /<p>Body/);
  assert.equal((await fetch(s.url + 'native-ui.js', { headers: { Origin: 'null' } })).status, 200);
  assert.equal((await fetch(s.url + 'vendor/magpie/components.css')).status, 200);
  assert.equal(
    (
      await fetch(s.url + 'api/skill/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: f.ssot,
          path: 'dev/sample-skill',
          file: 'SKILL.md',
          text: 'bad',
          expectedText: '',
        }),
      })
    ).status,
    403,
  );
  const original = await (
    await fetch(s.url + 'api/skill/read', {
      method: 'POST',
      headers,
      body: JSON.stringify({ source: f.ssot, path: 'dev/sample-skill' }),
    })
  ).json();
  const saved = await fetch(s.url + 'api/skill/save', {
    method: 'POST',
    headers: { ...headers, Origin: 'null' },
    body: JSON.stringify({
      source: f.ssot,
      path: 'dev/sample-skill',
      file: 'SKILL.md',
      text: original.text + 'Updated through API\n',
      expectedText: original.text,
    }),
  });
  assert.equal(saved.status, 200);
  assert.match((await saved.json()).text, /Updated through API/);
  assert.equal((await fetch(s.url + 'skill-reader.js')).status, 200);
  const cors = await fetch(s.url + 'api/state', { headers: { ...headers, Origin: 'null' } });
  assert.equal(cors.status, 200);
  assert.equal(cors.headers.get('access-control-allow-origin'), 'null');
  assert.equal(
    (
      await fetch(s.url + 'api/project/add', {
        method: 'POST',
        headers,
        body: JSON.stringify({ dir: f.dir }),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(s.url + 'api/deployments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dir: f.dir, source: f.ssot }),
      })
    ).status,
    403,
  );
  const deployments = await fetch(s.url + 'api/deployments', {
    method: 'POST',
    headers: { ...headers, Origin: 'null' },
    body: JSON.stringify({ dir: f.dir, source: f.ssot }),
  });
  assert.equal(deployments.status, 200);
  assert.deepEqual((await deployments.json()).skills, []);
  const manual = path.join(f.dir, '.agents/skills/manual-skill');
  await mkdir(manual, { recursive: true });
  await writeFile(
    path.join(manual, 'SKILL.md'),
    '---\nname: manual-skill\ndescription: Existing workspace skill\n---\nBody\n',
  );
  assert.equal(
    (
      await fetch(s.url + 'api/workspace/skills', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dir: f.dir }),
      })
    ).status,
    403,
  );
  const workspace = await (
    await fetch(s.url + 'api/workspace/skills', {
      method: 'POST',
      headers,
      body: JSON.stringify({ dir: f.dir }),
    })
  ).json();
  const manualSkill = workspace.skills.find(
    (skill) => skill.relative === '.agents/skills/manual-skill',
  );
  assert.equal(manualSkill.kind, 'directory');
  assert.equal(
    (
      await fetch(s.url + 'api/workspace/skill/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dir: f.dir, relative: manualSkill.relative }),
      })
    ).status,
    403,
  );
  const manualDocument = await (
    await fetch(s.url + 'api/workspace/skill/read', {
      method: 'POST',
      headers,
      body: JSON.stringify({ dir: f.dir, relative: manualSkill.relative }),
    })
  ).json();
  assert.equal(manualDocument.name, 'manual-skill');
  assert.match(manualDocument.html, /<p>Body/);
  const savedWorkspaceSkill = await fetch(s.url + 'api/workspace/skill/save', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dir: f.dir,
      relative: manualSkill.relative,
      file: 'SKILL.md',
      text: manualDocument.text + 'Updated through workspace API\n',
      expectedText: manualDocument.text,
    }),
  });
  assert.equal(savedWorkspaceSkill.status, 200);
  assert.match((await savedWorkspaceSkill.json()).text, /Updated through workspace API/);
  assert.equal(
    (
      await fetch(s.url + 'api/workspace/skill/read', {
        method: 'POST',
        headers,
        body: JSON.stringify({ dir: f.dir, relative: '.agents/skills/../escaped' }),
      })
    ).status,
    400,
  );
  const updatedWorkspace = await (
    await fetch(s.url + 'api/workspace/skills', {
      method: 'POST',
      headers,
      body: JSON.stringify({ dir: f.dir }),
    })
  ).json();
  const updatedManualSkill = updatedWorkspace.skills.find(
    (skill) => skill.relative === '.agents/skills/manual-skill',
  );
  const deleted = await fetch(s.url + 'api/workspace/skill/delete', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dir: f.dir,
      relative: updatedManualSkill.relative,
      fingerprint: updatedManualSkill.fingerprint,
    }),
  });
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).kind, 'directory');
  await assert.rejects(lstat(manual), { code: 'ENOENT' });
  const plan = await (
    await fetch(s.url + 'api/plan', {
      method: 'POST',
      headers,
      body: JSON.stringify({ dir: f.dir }),
    })
  ).json();
  assert(plan.ok);
  assert.equal(
    (await fetch(s.url + 'api/project/add', { method: 'POST', headers, body: '!bad' })).status,
    400,
  );
  assert.equal(
    (
      await fetch(s.url + 'api/project/add', {
        method: 'POST',
        headers,
        body: 'x'.repeat(1024 * 1024 + 1),
      })
    ).status,
    413,
  );
});
test('apply accepts a manifest draft and rejects a stale baseline', async (t) => {
  const f = await fixture(t),
    s = await startServer({ port: 0, configDir: path.join(f.base, 'config') });
  t.after(() => s.close());
  const html = await (await fetch(s.url)).text(),
    token = html.match(/name="page-token" content="([^"]+)"/)[1],
    headers = { 'x-skill-workspaces-token': token, 'content-type': 'application/json' };
  assert.equal(
    (
      await fetch(s.url + 'api/project/add', {
        method: 'POST',
        headers,
        body: JSON.stringify({ dir: f.dir }),
      })
    ).status,
    200,
  );
  const draft = f.text.replace('agents: [cursor, codex, claude]', 'agents: [cursor]'),
    apply = (text, expectedText) =>
      fetch(s.url + 'api/apply', {
        method: 'POST',
        headers,
        body: JSON.stringify({ dir: f.dir, text, expectedText }),
      });
  assert.equal(
    (
      await fetch(s.url + 'api/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dir: f.dir, text: draft, expectedText: f.text }),
      })
    ).status,
    403,
  );
  const applied = await apply(draft, f.text);
  assert.equal(applied.status, 200);
  assert.equal((await applied.json()).ok, true);
  assert.equal(await readFile(f.manifestPath, 'utf8'), draft);
  const stale = f.text + 'deploy: {method: copy}\n',
    rejected = await apply(stale, f.text);
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /changed on disk/);
  assert.equal(await readFile(f.manifestPath, 'utf8'), draft);
  await rm(f.manifestPath);
  const created = await apply(f.text, '');
  assert.equal(created.status, 200);
  assert.equal((await created.json()).ok, true);
  assert.equal(await readFile(f.manifestPath, 'utf8'), f.text);
});
