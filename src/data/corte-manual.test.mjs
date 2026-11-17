import test from 'node:test';
import assert from 'node:assert/strict';
import { CORTE, ESTADOS_CLIENTE } from './corte-manual.mjs';

test('corte manual: 13 clientes con estado conocido y etiqueta honesta', () => {
  assert.equal(CORTE.clientes.length, 13);
  const estados = new Set(ESTADOS_CLIENTE.map(([e]) => e));
  for (const c of CORTE.clientes) assert.ok(estados.has(c.estado), c.nombre);
  assert.match(CORTE.etiqueta, /no es en vivo/);
});

test('corte manual: cada desarrollo tiene semáforo válido y ningún texto genérico', () => {
  for (const d of CORTE.desarrollos) {
    assert.ok(['verde', 'mostaza', 'rojo'].includes(d.semaforo), d.nombre);
    assert.doesNotMatch(d.nombre, /gen[eé]rico/i);
  }
});
