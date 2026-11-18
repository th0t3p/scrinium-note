import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const base = resolve('dist');
const portAt = process.argv.indexOf('--port');
const port = portAt >= 0 ? Number(process.argv[portAt + 1]) : 5194;
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port.');
const contentTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.md':'text/plain; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.json':'application/json' };
const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('X-Frame-Options','DENY');
  response.setHeader('Referrer-Policy','no-referrer');
  response.setHeader('Cache-Control','no-cache');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'");
  if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(base + sep) || !(await stat(file)).isFile()) { response.writeHead(404).end(); return; }
    const data = await readFile(file);
    response.setHeader('Content-Type',contentTypes[extname(file)] ?? 'application/octet-stream');
    response.writeHead(200).end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(404).end(); }
});
server.listen(port, '127.0.0.1', () => console.log(`Community preview: http://127.0.0.1:${port}/`));
