import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaFrame, createExternalAssetLink } from './atlas-media.mjs';

// Minimal DOM boundary: these objects cannot fetch or execute remote content.
class Element {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this._text = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); return child; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
}

function installDocument(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true, value: { createElement: (tag) => new Element(tag) },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  });
}

function descendants(node) {
  return [node, ...node.children.flatMap(descendants)];
}

function asset(url, kind = 'embed') {
  return { id: 'fixture', label: '<img src=x onerror=alert(1)>', url, kind };
}

function assertExternalFallback(frame, original) {
  const nodes = descendants(frame);
  assert.equal(nodes.some((node) => ['IFRAME', 'OBJECT', 'EMBED', 'IMG', 'VIDEO', 'AUDIO'].includes(node.tagName)), false,
    'external-only media must not create an embedded resource');
  const links = nodes.filter((node) => node.tagName === 'A');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, original.url);
  assert.equal(links[0].target, '_blank');
  assert.deepEqual(new Set(links[0].rel.split(/\s+/)), new Set(['noopener', 'noreferrer']));
  assert.match(frame.textContent, /vista previa|incrustad/i);
  assert.match(frame.textContent, /dominio.*no.*permitido|enlace externo/i);
}

const blockedUrls = [
  'https://external.example.com/page?keep=%2F#original',
  'https://external.example.com/report.pdf',
  'https://drive.usercontent.google.com/download?id=fixture',
  'https://www.youtube.com.external.example/watch?v=fixture',
  'https://drive.google.com.external.example/page',
  'https://external.example.com/file/d/fixture/view',
  'https://external.example.com/document/d/fixture/edit',
  'https://drive.usercontent.google.com/file/d/fixture/view',
];
for (const url of blockedUrls) {
  for (const kind of ['auto', 'image', 'video', 'audio', 'pdf', 'embed', 'link']) {
    test(`untrusted ${kind} stays an external link: ${url}`, (t) => {
      installDocument(t);
      const original = Object.freeze(asset(url, kind));
      assertExternalFallback(createMediaFrame(original), original);
    });
  }
}

for (const url of [
  'https://drive.google.com/file/d/fixture/view',
  'https://docs.google.com/document/d/fixture/edit',
  'https://www.youtube.com/watch?v=fixture',
  'https://player.vimeo.com/video/123456',
  'https://cdn.example.com/clip.mp4',
]) {
  test(`explicit link never embeds: ${url}`, (t) => {
    installDocument(t);
    const original = Object.freeze(asset(url, 'link'));
    assertExternalFallback(createMediaFrame(original), original);
  });
}

const trustedPreviews = [
  ['https://drive.google.com/file/d/fixture/view', 'https://drive.google.com/file/d/fixture/preview'],
  ['https://docs.google.com/document/d/fixture/edit', 'https://docs.google.com/document/d/fixture/preview'],
  ['https://www.youtube.com/watch?v=fixture', 'https://www.youtube.com/embed/fixture'],
  ['https://youtube.com/watch?v=fixture', 'https://www.youtube.com/embed/fixture'],
  ['https://youtube.com/embed/fixture?start=10', 'https://www.youtube.com/embed/fixture?start=10'],
  ['https://youtu.be/fixture', 'https://www.youtube.com/embed/fixture'],
  ['https://vimeo.com/123456', 'https://player.vimeo.com/video/123456'],
  ['https://player.vimeo.com/video/123456', 'https://player.vimeo.com/video/123456'],
];
for (const [url, expected] of trustedPreviews) {
  test(`trusted preview keeps the provider: ${url}`, (t) => {
    installDocument(t);
    const original = Object.freeze(asset(url));
    const frame = createMediaFrame(original);
    assert.equal(frame.tagName, 'IFRAME');
    assert.equal(frame.src, expected);
    assert.equal(frame.title, original.label);
    assert.equal(original.url, url);
    assert.equal(original.kind, 'embed');
    assert.equal(frame.loading, 'lazy');
    assert.equal(frame.referrerPolicy, 'no-referrer');
  });
}

for (const [url] of trustedPreviews) {
  test(`trusted preview has only necessary sandbox capabilities: ${url}`, (t) => {
    installDocument(t);
    const frame = createMediaFrame(asset(url));
    assert.deepEqual(new Set(frame.getAttribute('sandbox').split(/\s+/)),
      new Set(['allow-scripts', 'allow-same-origin', 'allow-presentation']));
    assert.equal(frame.allow, 'autoplay; fullscreen; picture-in-picture');
    assert.equal(frame.getAttribute('allowfullscreen'), '');
  });
}

for (const [url, kind, expectedTag] of [
  ['https://drive.google.com/file/d/clip.mp4', 'video', 'VIDEO'],
  ['https://docs.google.com/document/d/cover.svg', 'image', 'IMG'],
  ['https://www.youtube.com/file/d/sound.ogg', 'audio', 'AUDIO'],
]) {
  test(`native media keeps its original source: ${url}`, (t) => {
    installDocument(t);
    const frame = createMediaFrame(Object.freeze(asset(url, kind)));
    assert.equal(frame.tagName, expectedTag);
    assert.equal(frame.src, url);
  });
}

for (const [kind, file, expectedTag] of [
  ['image', 'image.webp', 'IMG'], ['image', 'image.svg', 'IMG'],
  ['video', 'clip.mp4', 'VIDEO'], ['audio', 'clip.ogg', 'AUDIO'],
]) {
  test(`direct ${kind} remains native media rather than an iframe`, (t) => {
    installDocument(t);
    const original = Object.freeze(asset(`https://cdn.example.com/${file}?keep=%2F#original`, kind));
    const frame = createMediaFrame(original);
    assert.equal(frame.tagName, expectedTag);
    assert.equal(frame.src, original.url);
    if (kind === 'image') assert.equal(frame.alt, original.label);
    else assert.equal(frame.controls, true);
  });
}

for (const url of [
  'javascript:alert(1)', 'data:text/html,test', 'http://external.example.com/page',
  'https://drive.google.com:8443/file/d/fixture/view',
  'https://dummy:dummy@drive.google.com/file/d/fixture/view',
  '//drive.google.com/file/d/fixture/view', 'not-a-url',
]) {
  test(`unsafe URL cannot create a frame or external link: ${url}`, (t) => {
    installDocument(t);
    assert.throws(() => createMediaFrame(asset(url)));
    assert.throws(() => createExternalAssetLink(asset(url)));
  });
}
