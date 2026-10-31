import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { assertNoLocalArtifacts, build, validateShell } from './build.mjs';

const shell = `<!doctype html>
<html><body>
<script type="module" src="src/app/rr-tree.mjs"></script>
<link rel="stylesheet" href="src/styles/rr-tree.css">
<div data-canvas><div data-nodes></div><aside data-inspector></aside></div>
</body></html>`;

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'rr-atlas-build-'));
  await mkdir(join(root, 'src', 'data', 'nested'), { recursive: true });
  await writeFile(join(root, 'index.html'), shell);
  await writeFile(join(root, 'rr-logo-mark.png'), 'fixture');
  await writeFile(join(root, 'src', 'app.mjs'), 'export default {};');
  await writeFile(join(root, 'src', 'data', 'public.mjs'), 'export default {};');
  await writeFile(join(root, 'src', 'data', 'local-overrides.mjs'), 'export default {};\n');
  await writeFile(join(root, 'src', 'data', 'atlas.local.json'), '{"overrides":{"node-generic":{"status":"preview"}}}');
  await writeFile(join(root, 'src', 'data', 'nested', 'extra.local.mjs'), 'export default {};');
  return root;
}

async function allFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await allFiles(join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files;
}

async function withFixture(callback) {
  const root = await fixture();
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('validateShell acepta el shell actual y rechaza shells inválidos', async () => {
  const current = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(validateShell(current), current);
  assert.throws(() => validateShell('<!doctype html><html><body></body></html>'), /Missing shell marker/);
  assert.throws(
    () => validateShell('<!doctype html>src/app/rr-tree.mjs src/styles/rr-tree.css data-canvas data-nodes data-inspector localStorage.setItem'),
    /Application logic leaked/,
  );
});

test('build público excluye todos los archivos .local y deja el stub', async () => {
  await withFixture(async (root) => {
    await build(root);
    const files = await allFiles(join(root, 'dist'));
    assert.equal(files.some((file) => file.includes('.local.')), false);
    assert.equal(
      await readFile(join(root, 'dist', 'src', 'data', 'local-overrides.mjs'), 'utf8'),
      'export default {};\n',
    );
    assert.equal(await readFile(join(root, 'dist', 'src', 'data', 'public.mjs'), 'utf8'), 'export default {};');
  });
});

test('build local genera overrides desde un objeto JSON sin mutar la fuente', async () => {
  await withFixture(async (root) => {
    const source = await readFile(join(root, 'src', 'data', 'atlas.local.json'), 'utf8');
    const sourceStub = await readFile(join(root, 'src', 'data', 'local-overrides.mjs'), 'utf8');
    await build({ root, local: true });
    const generated = await readFile(join(root, 'dist', 'src', 'data', 'local-overrides.mjs'), 'utf8');
    assert.match(generated, /^export default \{/);
    assert.match(generated, /"node-generic"/);
    assert.equal(await readFile(join(root, 'src', 'data', 'atlas.local.json'), 'utf8'), source);
    assert.equal(await readFile(join(root, 'src', 'data', 'local-overrides.mjs'), 'utf8'), sourceStub);
    const files = await allFiles(join(root, 'dist'));
    assert.equal(files.some((file) => file.includes('.local.')), false);
  });
});

test('build local rechaza JSON válido que sea un array', async () => {
  await withFixture(async (root) => {
    await writeFile(join(root, 'src', 'data', 'atlas.local.json'), '[]');
    await assert.rejects(() => build(root, { local: true }), /objeto JSON.*no.*array/i);
  });
});

test('assertNoLocalArtifacts falla si un .local aparece en el dist', async () => {
  await withFixture(async (root) => {
    await build(root);
    assert.equal(await assertNoLocalArtifacts(join(root, 'dist')), true);
    await writeFile(join(root, 'dist', 'src', 'data', 'fuga.local.json'), '{}');
    await assert.rejects(() => assertNoLocalArtifacts(join(root, 'dist')), /Artefactos locales/);
  });
});
