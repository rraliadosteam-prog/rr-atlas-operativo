import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PENDIENTES, agruparPendientes, lineaPendiente } from './pendientes.mjs';

test('cada hueco trae fuente y corte, y está en estado «sin confirmar»', () => {
  assert.ok(PENDIENTES.length >= 15, 'la lista de huecos está incompleta');
  for (const pendiente of PENDIENTES) {
    assert.ok(pendiente.id, 'hueco sin id');
    assert.ok(pendiente.titulo, `${pendiente.id} sin título`);
    assert.ok(pendiente.detalle, `${pendiente.id} sin detalle`);
    assert.equal(typeof pendiente.fuente, 'string');
    assert.ok(pendiente.fuente.trim().length > 0, `${pendiente.id} sin fuente`);
    assert.equal(typeof pendiente.corte, 'string');
    assert.ok(pendiente.corte.trim().length > 0, `${pendiente.id} sin corte`);
    assert.equal(pendiente.estado, 'sin confirmar', `${pendiente.id} no está en estado «sin confirmar»`);
  }
});

test('no se repiten ids', () => {
  const ids = PENDIENTES.map((pendiente) => pendiente.id);
  assert.equal(new Set(ids).size, ids.length, 'hay ids repetidos');
});

test('la lista cubre los huecos mínimos del mega prompt §10', () => {
  const texto = PENDIENTES.map((pendiente) => `${pendiente.titulo} ${pendiente.detalle}`).join(' ').toLowerCase();
  const obligatory = [
    'project manager',
    'camarógrafo',
    'sla de soporte',
    'kpi de producción',
    'sesión de grabación',
    'quién cubre soporte',
    'cuenta de cobro',
    'precios y planes',
    'buen puente',
    'flota hermes',
    'media manager',
    'martín',
    'isabela',
    'tipografía oficial',
    'zapatos',
    'turismo anheyca',
    'satiro_sushi',
    'imf visions',
    'amsterdam',
    'billares charly brown',
    'rutas /bpmn/',
    'runway',
  ];
  for (const frase of obligatory) {
    assert.ok(texto.includes(frase), `falta el hueco «${frase}»`);
  }
});

test('ningún hueco trae cifras financieras', () => {
  const texto = JSON.stringify(PENDIENTES);
  assert.equal(/\$\s?\d/.test(texto), false, 'hay un monto con signo de pesos');
  assert.equal(/\bCOP\b/.test(texto), false, 'hay una cifra en COP');
  assert.equal(/\b\d{1,3}(?:[.,]\d{3})+(?!\d)/.test(texto), false, 'hay un monto con separador de miles');
  assert.equal(/\bsaldo\b/i.test(texto), false, 'hay un saldo');
  assert.equal(/\d+\s*mes(es)?\s+de\s+runway\b/i.test(texto), false, 'hay una cifra de runway');
});

test('los huecos se agrupan por tipo y cada grupo trae su título legible', () => {
  const grupos = agruparPendientes();
  assert.ok(grupos.length >= 5, 'hay muy pocos grupos');
  const total = grupos.reduce((suma, grupo) => suma + grupo.total, 0);
  assert.equal(total, PENDIENTES.length, 'los grupos no cubren todos los huecos');
  for (const grupo of grupos) {
    assert.ok(grupo.titulo, `el grupo ${grupo.tipo} no tiene título`);
  }
});

test('la línea de un hueco dice el título, la fuente y el corte', () => {
  const pendiente = PENDIENTES[0];
  const linea = lineaPendiente(pendiente);
  assert.ok(linea.includes(pendiente.titulo));
  assert.ok(linea.includes(pendiente.fuente));
  assert.ok(linea.includes(pendiente.corte));
});
