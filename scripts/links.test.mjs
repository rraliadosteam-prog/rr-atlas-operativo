import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from './build.mjs';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const dist = resolve(root, 'dist');

const isInternal = (url, origin) => {
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === origin && !parsed.protocol.startsWith('data') && !parsed.protocol.startsWith('javascript');
  } catch {
    return false;
  }
};

const normalizePath = (url, origin) => {
  const parsed = new URL(url, origin);
  let pathname = parsed.pathname;
  if (pathname.endsWith('/')) pathname += 'index.html';
  return pathname;
};

async function crawl(origin, seeds) {
  const pending = [...seeds];
  const visited = new Set();
  const resources = new Map();

  while (pending.length > 0) {
    const current = pending.pop();
    if (visited.has(current)) continue;
    visited.add(current);

    const pathname = normalizePath(current, origin);
    const filePath = resolve(dist, pathname.startsWith('/') ? pathname.slice(1) : pathname);
    if (!filePath.startsWith(`${dist}${sep}`)) {
      resources.set(current, { status: 403, error: 'outside dist' });
      continue;
    }

    let status = 404;
    let body = '';
    try {
      body = await readFile(filePath, 'utf8');
      status = 200;
    } catch (error) {
      status = error?.code === 'ENOENT' ? 404 : 500;
    }
    resources.set(current, { status, pathname });

    if (status !== 200 || !filePath.endsWith('.html')) continue;

    const hrefMatches = body.matchAll(/href=['"]([^'"]+)['"]/gi);
    const srcMatches = body.matchAll(/src=['"]([^'"]+)['"]/gi);
    for (const match of [...hrefMatches, ...srcMatches]) {
      const url = match[1].trim();
      if (!url || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) continue;
      if (!isInternal(url, origin)) continue;
      const next = new URL(url, current).href.split('#')[0];
      if (!visited.has(next)) pending.push(next);
    }
  }

  return resources;
}

test('build sirve todos los enlaces internos sin 404', async () => {
  await build(root);
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://local').pathname;
    const filePath = resolve(dist, pathname === '/' ? 'index.html' : pathname.slice(1));
    readFile(filePath)
      .then((body) => response.writeHead(200, { 'Content-Type': 'text/html' }).end(body))
      .catch(() => response.writeHead(404).end());
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const resources = await crawl(origin, [origin, `${origin}/grafo/`]);
    resources.set(`${origin}/grafo/grafo.json`, { status: (await readFile(resolve(dist, 'grafo/grafo.json')).then(() => 200).catch(() => 404)) });
    const broken = [...resources.entries()].filter(([, { status }]) => status !== 200);
    assert.deepEqual(
      broken.map(([url, { status, error }]) => ({ url, status, error })),
      [],
      `Enlaces rotos encontrados en ${resources.size} recursos`,
    );
    assert.ok(resources.has(`${origin}/grafo/`), 'El visor de grafo documental está enrutado dentro del build');
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
