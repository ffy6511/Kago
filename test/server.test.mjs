import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
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
  assert.equal(
    (
      await fetch(s.url + 'api/state', {
        headers: { ...headers, Origin: 'https://attacker.example' },
      })
    ).status,
    403,
  );
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
