#!/usr/bin/env node
/** Serve the bundled production build without installing dependencies. Node 20+. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = Object.freeze({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' });
function respond(response, code, message) {
  response.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
  response.end(message);
}
export function createStaticServer(directory = path.join(projectRoot, 'dist')) {
  const root = path.resolve(directory);
  return http.createServer((request, response) => {
    if (!['GET','HEAD'].includes(request.method)) { response.setHeader('Allow','GET, HEAD'); return respond(response,405,'Method not allowed.'); }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { return respond(response,400,'Invalid request path.'); }
    if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(segment => segment.startsWith('.'))) return respond(response,404,'File not found.');
    const requested = path.resolve(root, `.${pathname}`);
    if (requested !== root && !requested.startsWith(root + path.sep)) return respond(response,404,'File not found.');
    let file = requested;
    try {
      const stats = fs.statSync(file);
      if (stats.isDirectory()) file = path.join(file,'index.html');
    } catch {
      if (path.extname(pathname)) return respond(response,404,'File not found.');
      file = path.join(root,'index.html'); // Client-side application route.
    }
    let stats;
    try {
      stats = fs.statSync(file);
      if (!stats.isFile()) return respond(response,404,'File not found.');
      // Even a mistakenly packaged symlink must not expose files outside the build.
      const real = fs.realpathSync(file);
      if (real !== root && !real.startsWith(fs.realpathSync(root) + path.sep)) return respond(response,404,'File not found.');
    } catch { return respond(response,404,'File not found. Build the app with npm run build first.'); }
    const headers = {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stats.size,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    };
    response.writeHead(200, headers);
    if (request.method === 'HEAD') return response.end();
    const stream = fs.createReadStream(file);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  });
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('PORT must be an integer between 1 and 65535.'); process.exitCode = 1; }
  else if (!fs.existsSync(path.join(projectRoot, 'dist', 'index.html'))) { console.error('The production build is missing. Run npm install, then npm run build.'); process.exitCode = 1; }
  else {
    const server = createStaticServer();
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Close the other server, or choose a different PORT.` : `Unable to start: ${error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`\nALIEN KARAOKE BOOTH\nOpen http://localhost:${port}\nPress Ctrl+C to stop.\n`);
    });
    const stop = () => server.close(() => process.exit(0));
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  }
}
