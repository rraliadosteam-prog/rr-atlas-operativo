import assert from 'node:assert/strict';
import test from 'node:test';
import { HUB_LABEL, HUB_URL, HUB_URL_LOCAL, hubUrlFrom } from './hub-link.mjs';

test('el enlace "Volver al hub RR" apunta por defecto al hub público (Mega Dashboard)', () => {
  assert.equal(HUB_LABEL, 'Volver al hub RR');
  assert.equal(HUB_URL, 'https://rr-aliados-mega-dashboard.vercel.app/');
  assert.equal(hubUrlFrom(), HUB_URL);
  assert.equal(hubUrlFrom({}), HUB_URL);
});

test('el enlace al HUB acepta un override explícito y rechaza valores vacíos', () => {
  assert.equal(hubUrlFrom({ hubUrl: HUB_URL_LOCAL }), 'http://localhost:8081/');
  assert.equal(hubUrlFrom({ hubUrl: 'http://127.0.0.1:9000/' }), 'http://127.0.0.1:9000/');
  assert.equal(hubUrlFrom({ hubUrl: '   ' }), HUB_URL);
  assert.equal(hubUrlFrom({ hubUrl: 42 }), HUB_URL);
});
