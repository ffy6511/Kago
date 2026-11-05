import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
const root = new URL('../ui/', import.meta.url);
export async function startServer({ port = 3498, configDir } = {}) {
  if (!Number.isInteger(Number(port)) || Number(port) < 0 || Number(port) > 65535) throw new Error('Invalid port');
  const token = randomBytes(32).toString('hex');
  const server = http.createServer(async (req, res) => {
    const host = `127.0.0.1:${server.address().port}`;
    const headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'};
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, {...headers, 'Content-Type': type});
      res.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    if (![host, `localhost:${server.address().port}`].includes(req.headers.host)) return send(403, {error: 'Untrusted Host'});
    const origin = req.headers.origin;
    if (origin && origin !== 'null' && ![`http://${host}`, `http://localhost:${server.address().port}`].includes(origin)) return send(403, {error: 'Untrusted Origin'});
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
          res.writeHead(204, headers); return res.end();
        }
        const got = Buffer.from(String(req.headers['x-skill-workspaces-token'] || ''));
        if (got.length !== token.length || !timingSafeEqual(got, Buffer.from(token))) return send(403, {error: 'Missing or invalid page token; reload the page'});
        if (pathname === '/api/health') return send(200, {ok: true, version: '0.1.0'});
        return send(404, {error: 'Unknown API'});
      }
      if (req.method !== 'GET') return send(405, {error: 'Method not allowed'});
      const assets = {'/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css']};
      if (!assets[pathname]) return send(404, {error: 'Not found'});
      const [file, type] = assets[pathname];
      const content = (await readFile(new URL(file, root), 'utf8')).replace('__PAGE_TOKEN__', token);
      return send(200, content, type);
    } catch (err) { return send(400, {error: err.message}); }
  });
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(Number(port), '127.0.0.1', resolve);});
  const url = `http://127.0.0.1:${server.address().port}/`;
  return { server, url, close: () => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())) };
}
