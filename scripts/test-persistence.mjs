import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateShell } from './build.mjs';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.equal(validateShell(html), html);
assert.match(html, /src\/app\/rr-tree\.mjs/);
assert.match(html, /src\/styles\/rr-tree\.css/);
assert.match(html, /data-canvas/);
assert.match(html, /data-nodes/);
assert.match(html, /data-inspector/);
assert.doesNotMatch(html, /const DEFAULT=/);
assert.doesNotMatch(html, /localStorage\.setItem/);
assert.throws(() => validateShell('<!doctype html><html><body></body></html>'), /Missing shell marker/);
assert.throws(
  () => validateShell('<!doctype html>src/app/rr-tree.mjs src/styles/rr-tree.css data-canvas data-nodes data-inspector const DEFAULT=1'),
  /Application logic leaked/,
);

console.log('frontend shell regression: ok');
