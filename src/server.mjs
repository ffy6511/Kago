import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Engine } from './engine.mjs';
import { parseManifest } from './manifest.mjs';
import { checkParents } from './plan.mjs';
const root = new URL('../ui/', import.meta.url);
async function body(req, limit = 1024 * 1024) {
  if (Number(req.headers['content-length']) > limit) {
    req.resume();
    throw Object.assign(new Error(`Request body exceeds ${limit / 1024 / 1024} MiB`), {
      status: 413,
    });
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit)
      throw Object.assign(new Error(`Request body exceeds ${limit / 1024 / 1024} MiB`), {
        status: 413,
      });
    chunks.push(chunk);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('Expected a JSON object');
  return data;
}
async function openFolder(dir) {
  const child = spawn(
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open',
    [dir],
    { stdio: 'ignore' },
  );
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('spawn', resolve);
  });
  child.unref();
}
export async function startServer({ port = 3498, configDir, magpieDir } = {}) {
  if (!Number.isInteger(Number(port)) || Number(port) < 0 || Number(port) > 65535)
    throw new Error('Invalid port');
  const engine = new Engine({ configDir, magpieDir });
  const nativeAssets = new Set(await readdir(new URL('vendor/magpie/', root)));
  const token = randomBytes(32).toString('hex');
  const server = http.createServer(async (req, res) => {
    const host = `127.0.0.1:${server.address().port}`;
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    };
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { ...headers, 'Content-Type': type });
      res.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    if (![host, `localhost:${server.address().port}`].includes(req.headers.host))
      return send(403, { error: 'Untrusted Host' });
    const origin = req.headers.origin;
    if (
      origin &&
      origin !== 'null' &&
      ![`http://${host}`, `http://localhost:${server.address().port}`].includes(origin)
    )
      return send(403, { error: 'Untrusted Origin' });
    try {
      const pathname = new URL(req.url, `http://${host}`).pathname;
      if (pathname.startsWith('/api/')) {
        if (origin === 'null') {
          headers['Access-Control-Allow-Origin'] = 'null';
          headers.Vary = 'Origin';
        }
        if (req.method === 'OPTIONS') {
          headers['Access-Control-Allow-Methods'] = 'GET, POST';
          headers['Access-Control-Allow-Headers'] = 'content-type, x-skill-workspaces-token';
          res.writeHead(204, headers);
          return res.end();
        }
        const got = Buffer.from(String(req.headers['x-skill-workspaces-token'] || ''));
        if (got.length !== token.length || !timingSafeEqual(got, Buffer.from(token)))
          return send(403, { error: 'Missing or invalid page token; reload the page' });
        if (req.method === 'GET' && pathname === '/api/health')
          return send(200, { ok: true, version: '0.1.0' });
        if (req.method === 'GET' && pathname === '/api/state')
          return send(200, await engine.status());
        if (req.method !== 'POST') return send(405, { error: 'Use POST for this operation' });
        const data = await body(req, pathname === '/api/skill/save' ? 16 * 1024 * 1024 : undefined);
        const required = (value, label) => {
          if (typeof value !== 'string' || !value.trim() || value.includes('\0'))
            throw new Error(`Missing or invalid ${label}`);
          return value;
        };
        const registered = async () => {
          required(data.dir, 'project directory');
          const state = await engine.status();
          if (!state.projects.some((p) => p.dir === data.dir))
            throw new Error('Register this project first');
        };
        if (pathname === '/api/source/add')
          return send(200, await engine.registerSource(required(data.dir, 'source directory')));
        if (pathname === '/api/source/remove')
          return send(200, await engine.removeSource(required(data.dir, 'source directory')));
        if (pathname === '/api/scan')
          return send(200, await engine.scan(required(data.dir, 'source directory')));
        if (pathname === '/api/skill/read')
          return send(
            200,
            await engine.readSkillDocument(
              required(data.source, 'source directory'),
              required(data.path, 'skill path'),
              data.file === undefined ? 'SKILL.md' : required(data.file, 'skill file'),
            ),
          );
        if (pathname === '/api/skill/save')
          return send(
            200,
            await engine.saveSkillDocument(
              required(data.source, 'source directory'),
              required(data.path, 'skill path'),
              required(data.file, 'skill file'),
              data.text,
              data.expectedText,
            ),
          );
        if (pathname === '/api/skill/reveal') {
          const skill = await engine.resolveSkill(
            required(data.source, 'source directory'),
            required(data.path, 'skill path'),
          );
          await openFolder(skill.dir);
          return send(200, { ok: true });
        }
        if (pathname === '/api/project/add')
          return send(
            200,
            await engine.registerProject(
              required(data.dir, 'project directory'),
              data.manifestPath,
            ),
          );
        if (pathname === '/api/sync') return send(200, await engine.syncAll());
        if (pathname === '/api/draft') {
          const text = engine.draft(
            required(data.source, 'source directory'),
            data.skills,
            data.agents,
            data.method,
          );
          parseManifest(text);
          return send(200, { text });
        }
        if (pathname === '/api/reveal') {
          const state = await engine.status(),
            dir = required(data.dir, 'directory');
          if (
            ![...state.sources, ...state.projects, { dir: state.library.dir }].some(
              (p) => p.dir === dir,
            )
          )
            throw new Error('Only registered folders can be opened');
          await openFolder(dir);
          return send(200, { ok: true });
        }
        await registered();
        if (pathname === '/api/project/remove')
          return send(200, await engine.removeProject(data.dir, { keep: data.keep !== false }));
        if (pathname === '/api/project') {
          const manifest = await engine.readManifest(data.dir);
          let doc, parseError;
          const conflicts = [];
          try {
            if (manifest.text) doc = parseManifest(manifest.text);
          } catch (e) {
            parseError = e.message;
          }
          for (const relative of ['.agents/skills/check', '.claude/skills/check'])
            try {
              await checkParents(data.dir, relative);
            } catch (e) {
              conflicts.push(e.message);
            }
          return send(200, {
            ...manifest,
            doc,
            parseError,
            source: doc ? path.resolve(path.dirname(manifest.file), doc.ssot) : null,
            conflicts,
          });
        }
        if (pathname === '/api/parse') {
          const manifest = await engine.readManifest(data.dir),
            doc = parseManifest(required(data.text, 'manifest text'));
          return send(200, { doc, source: path.resolve(path.dirname(manifest.file), doc.ssot) });
        }
        if (pathname === '/api/manifest/save')
          return send(
            200,
            await engine.saveManifest(data.dir, required(data.text, 'manifest text'), {
              expectedText: data.expectedText,
            }),
          );
        if (pathname === '/api/plan')
          return send(200, await engine.plan(data.dir, { text: data.text }));
        if (pathname === '/api/apply') return send(200, await engine.apply(data.dir));
        return send(404, { error: 'Unknown API' });
      }
      if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });
      const assets = {
        '/': ['index.html', 'text/html; charset=utf-8'],
        '/app.js': ['app.js', 'text/javascript'],
        '/native-ui.js': ['native-ui.js', 'text/javascript'],
        '/skill-reader.js': ['skill-reader.js', 'text/javascript'],
        '/style.css': ['style.css', 'text/css'],
      };
      const nativeName = pathname.startsWith('/vendor/magpie/')
        ? pathname.slice('/vendor/magpie/'.length)
        : '';
      if (/^[a-z0-9.-]+\.(svg|css|js)$/.test(nativeName) && nativeAssets.has(nativeName)) {
        if (origin === 'null') {
          headers['Access-Control-Allow-Origin'] = 'null';
          headers.Vary = 'Origin';
        }
        const type = nativeName.endsWith('.svg')
          ? 'image/svg+xml'
          : nativeName.endsWith('.css')
            ? 'text/css'
            : 'text/javascript';
        return send(
          200,
          await readFile(new URL('vendor/magpie/' + nativeName, root), 'utf8'),
          type,
        );
      }
      if (!Object.hasOwn(assets, pathname)) return send(404, { error: 'Not found' });
      const [file, type] = assets[pathname];
      const content = (await readFile(new URL(file, root), 'utf8')).replace(
        '__PAGE_TOKEN__',
        token,
      );
      return send(200, content, type);
    } catch (err) {
      return send(err.status || 400, { error: err.message });
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number(port), '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}/`;
  return {
    server,
    url,
    close: () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}
