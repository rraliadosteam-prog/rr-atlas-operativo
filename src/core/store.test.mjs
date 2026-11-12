import { test } from 'node:test';
import assert from 'node:assert/strict';

import { crearStore, crearMemoria } from './store.mjs';
import { STORAGE_KEY } from './model.mjs';

const persona = (extra = {}) => ({
  id: 'persona-1',
  nombre: 'Persona de prueba',
  descripcion: '',
  fuente: '20_Empresa/equipo.md',
  corte: '2026-09-26',
  estado: 'activo',
  etiquetas: [],
  actualizadoEn: '',
  ...extra,
});

test('el store aplica un cambio y lo deja en el diff', () => {
  const store = crearStore({ base: { persona: [persona()] } });
  store.aplicar('persona', 'persona-1', { estado: 'histórico' });
  const estado = store.estado();
  assert.equal(estado.entidades.persona[0].estado, 'histórico');
  assert.equal(estado.diff.length, 1);
  assert.equal(estado.diff[0].tipo, 'cambiado');
});

test('el store guarda en memoria con la clave rr-atlas:v5 y recupera al recargar', () => {
  const memoria = crearMemoria();
  const store = crearStore({ base: { persona: [persona()] }, storage: memoria });
  store.aplicar('persona', 'persona-1', { estado: 'histórico' });
  assert.ok(memoria.getItem(STORAGE_KEY));

  const otro = crearStore({ base: { persona: [persona()] }, storage: memoria });
  assert.equal(otro.cargar(), true);
  assert.equal(otro.estado().entidades.persona[0].estado, 'histórico');
});

test('restaurar base borra los cambios locales', () => {
  const store = crearStore({ base: { persona: [persona()] } });
  store.aplicar('persona', 'persona-1', { estado: 'histórico' });
  store.restaurarBase();
  const estado = store.estado();
  assert.equal(estado.entidades.persona[0].estado, 'activo');
  assert.equal(estado.diff.length, 0);
});

test('exportar e importar por el store es idempotente', () => {
  const store = crearStore({ base: { persona: [persona()] } });
  store.aplicar('persona', 'persona-1', { estado: 'histórico' });
  const paquete = store.exportar();

  const otro = crearStore({ base: { persona: [persona()] } });
  otro.importar(paquete);
  assert.deepEqual(otro.exportar(), paquete);
  assert.equal(otro.estado().entidades.persona[0].estado, 'histórico');
});

test('el store rechaza una colección que no existe en el esquema v5', () => {
  const store = crearStore();
  assert.throws(() => store.aplicar('salario', 'x', {}), (error) => error.code === 'COLECCION');
});

test('el historial no crece sin límite', () => {
  const store = crearStore({ base: { persona: [persona()] }, limiteHistorial: 3 });
  for (let i = 0; i < 6; i += 1) store.aplicar('persona', 'persona-1', { estado: `estado-${i}` });
  assert.equal(store.estado().historial.length, 3);
});
