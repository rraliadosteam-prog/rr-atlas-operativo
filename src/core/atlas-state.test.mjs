import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AtlasDataError,
  createLocalRepository,
  normalizeGraph,
  parseSnapshot,
  validateDriveLink,
  classifyMediaUrl,
  drivePreviewUrl,
  validateMediaAsset,
  validateComment,
} from './atlas-state.mjs';

const graph = {
  data: [
    {
      id: 'a',
      title: 'A',
      type: 'Proceso',
      desc: '',
      owner: '',
      status: '',
      notes: '',
      x: 0,
      y: 0,
      width: 238,
      height: 125,
      links: [],
      shape: 'rectangle',
      color: 'fuchsia',
      media: [],
      comments: [],
    },
    {
      id: 'b',
      title: 'B',
      type: 'Cliente',
      desc: '',
      owner: '',
      status: '',
      notes: '',
      x: 100,
      y: 100,
      width: 238,
      height: 125,
      links: [['Drive', 'https://drive.google.com/file/d/example/view']],
      shape: 'hexagon',
      color: 'blue',
      media: [],
      comments: [],
    },
  ],
  lines: [['a', 'b']],
};

test('normalizes the legacy graph shape without mutation', () => {
  const input = structuredClone(graph);
  const normalized = normalizeGraph(input);
  assert.deepEqual(normalized, input);
  assert.notStrictEqual(normalized, input);
});

test('accepts version 1 exports', () => {
  const output = parseSnapshot(JSON.stringify({
    schemaVersion: 1,
    exportedAt: '2026-10-18T00:00:00.000Z',
    nodes: graph.data,
    edges: graph.lines,
    source: 'test',
  }));
  assert.deepEqual(output, graph);
});

test('adds safe defaults to legacy nodes and classifies media', () => {
  const legacy = structuredClone(graph);
  delete legacy.data[0].shape;
  delete legacy.data[0].color;
  delete legacy.data[0].media;
  const normalized = normalizeGraph(legacy);
  assert.equal(normalized.data[0].shape, 'rectangle');
  assert.equal(normalized.data[0].color, 'fuchsia');
  assert.deepEqual(normalized.data[0].media, []);
  assert.equal(classifyMediaUrl('https://cdn.example.com/photo.webp'), 'image');
  assert.equal(classifyMediaUrl('https://cdn.example.com/report.pdf'), 'pdf');
  assert.equal(drivePreviewUrl('https://drive.google.com/file/d/abc123/view'), 'https://drive.google.com/file/d/abc123/preview');
});

test('validates multimedia assets without allowing unsafe URLs', () => {
  const asset = validateMediaAsset({ id: 'm1', label: 'Demo', url: 'https://cdn.example.com/demo.mp4', kind: 'auto' });
  assert.equal(asset.kind, 'video');
  assert.equal(validateMediaAsset({ id: 'm1b', label: 'Video', url: 'https://www.youtube.com/watch?v=demo', kind: 'auto' }).kind, 'video');
  const external = { id: 'm1c', label: 'Embed', url: 'https://external.example.com/app', kind: 'embed' };
  assert.deepEqual(validateMediaAsset(external), external);
  assert.throws(() => validateMediaAsset({ id: 'm2', label: 'Unsafe', url: 'javascript:alert(1)', kind: 'auto' }), AtlasDataError);
  assert.throws(() => validateMediaAsset({ id: 'm3', label: 'Creds', url: 'https://user:pass@example.com/file.pdf', kind: 'auto' }), AtlasDataError);
});

test('preserves legacy HTTPS media and version 1 imports independently of embed policy', () => {
  const legacy = structuredClone(graph);
  legacy.data[0].media = ['embed', 'link', 'video', 'pdf', 'image', 'audio'].map((kind) => ({
    id: `legacy-${kind}`, label: `Referencia ${kind}`,
    url: `https://external.example.com/reference?kind=${kind}&keep=%2F#original`, kind,
  }));
  const before = structuredClone(legacy);
  assert.deepEqual(normalizeGraph(legacy), before);
  const snapshot = { schemaVersion: 1, nodes: legacy.data, edges: legacy.lines, source: 'test' };
  assert.deepEqual(parseSnapshot(JSON.stringify(snapshot)), before);
  assert.equal(snapshot.schemaVersion, 1);
  assert.deepEqual(legacy, before);
  const values = new Map();
  const repository = createLocalRepository({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  repository.save(legacy);
  assert.deepEqual(repository.load(), before);
});

for (const url of ['http://external.example.com/file', 'data:text/html,test', 'https://external.example.com:8443/file']) {
  test(`rejects unsafe media URL ${url}`, () => {
    for (const kind of ['embed', 'link', 'video', 'pdf']) {
      assert.throws(() => validateMediaAsset({ id: 'unsafe', label: 'Unsafe', url, kind }), AtlasDataError);
    }
  });
}

for (const url of [
  'https://external.example.com/file/d/fixture/view',
  'https://external.example.com/document/d/fixture/edit',
  'https://external.example.com/spreadsheets/d/fixture/edit',
  'https://external.example.com/presentation/d/fixture/edit',
  'https://drive.google.com.external.example/file/d/fixture/view',
  'https://docs.google.com.external.example/document/d/fixture/edit',
  'https://drive.usercontent.google.com/file/d/fixture/view',
  'https://drive.usercontent.google.com/document/d/fixture/edit',
  'https://www.youtube.com/file/d/fixture/view',
  'https://player.vimeo.com/document/d/fixture/edit',
  'https://drive.google.com/document/d/fixture/edit',
  'https://docs.google.com/file/d/fixture/view',
  'https://external.example.com/open?id=fixture',
  'https://youtube.com.external.example/watch?v=fixture',
  'https://youtu.be.external.example/fixture',
  'https://vimeo.com.external.example/123456',
]) {
  test(`preview transformation does not impersonate a provider: ${url}`, () => {
    assert.equal(drivePreviewUrl(url), url);
  });
}

for (const [url, expected] of [
  ['https://drive.google.com/file/d/fixture/view', 'https://drive.google.com/file/d/fixture/preview'],
  ['https://drive.google.com/open?id=fixture', 'https://drive.google.com/file/d/fixture/preview'],
  ['https://docs.google.com/document/d/fixture/edit', 'https://docs.google.com/document/d/fixture/preview'],
  ['https://docs.google.com/spreadsheets/d/fixture/edit', 'https://docs.google.com/spreadsheets/d/fixture/preview'],
  ['https://docs.google.com/presentation/d/fixture/edit', 'https://docs.google.com/presentation/d/fixture/preview'],
  ['https://youtu.be/fixture', 'https://www.youtube.com/embed/fixture'],
  ['https://youtube.com/embed/fixture?start=10', 'https://www.youtube.com/embed/fixture?start=10'],
  ['https://www.youtube.com/watch?v=fixture', 'https://www.youtube.com/embed/fixture'],
  ['https://vimeo.com/123456', 'https://player.vimeo.com/video/123456'],
]) {
  test(`preview transformation keeps its real provider: ${url}`, () => {
    assert.equal(drivePreviewUrl(url), expected);
  });
}

test('validates local comments without allowing empty content', () => {
  const comment = validateComment({ id: 'c1', text: 'Revisar con el equipo', createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z' });
  assert.equal(comment.text, 'Revisar con el equipo');
  assert.throws(() => validateComment({ id: 'c2', text: '', createdAt: 'x', updatedAt: 'x' }), AtlasDataError);
});

test('rejects unsafe Drive hosts and credentials', () => {
  assert.throws(() => validateDriveLink(['bad', 'https://evil.example/file']), AtlasDataError);
  assert.throws(() => validateDriveLink(['bad', 'https://drive.google.com:8443/file']), AtlasDataError);
  assert.throws(() => validateDriveLink(['bad', 'https://user:pass@drive.google.com/file']), AtlasDataError);
});

test('rejects duplicate nodes, dangling edges and self edges', () => {
  assert.throws(() => normalizeGraph({ ...graph, data: [graph.data[0], graph.data[0]] }), AtlasDataError);
  assert.throws(() => normalizeGraph({ ...graph, lines: [['a', 'missing']] }), AtlasDataError);
  assert.throws(() => normalizeGraph({ ...graph, lines: [['a', 'a']] }), AtlasDataError);
});

test('preserves the unsaved graph when storage write fails', () => {
  const storage = {
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
  };
  const repository = createLocalRepository(storage);
  assert.throws(() => repository.save(graph), (error) => error.code === 'STORAGE_WRITE_FAILED');
});

test('loads and saves through the storage adapter', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const repository = createLocalRepository(storage);
  repository.save(graph);
  assert.deepEqual(repository.load(), graph);
  repository.addLink('a', ['Docs', 'https://docs.google.com/document/d/example/edit']);
  assert.equal(repository.load().data[0].links.length, 1);
  repository.removeLink('a', 0);
  assert.equal(repository.load().data[0].links.length, 0);
});
