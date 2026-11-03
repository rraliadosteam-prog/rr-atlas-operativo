import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODO_ILEGIBLE,
  MODO_LEGIBLE,
  MODO_OTRO_DIAGRAMA,
  MODO_SIN_GANCHO,
  MODO_SIN_ZOOM,
  evaluarConjunto390,
  evaluarPiso390,
  leerEstadoLienzo,
} from './piso-390.mjs';
import { PISO_LEGIBILIDAD_DIAGRAMA } from '../src/core/zoom.mjs';

test('El piso que vigila la puerta es el declarado: 1,15', () => {
  assert.equal(PISO_LEGIBILIDAD_DIAGRAMA, 1.15);
});

test('Sin gancho: la puerta no falla, pero dice que no se puede certificar', () => {
  const veredicto = evaluarPiso390({ existeGancho: false, zoom: null });
  assert.equal(veredicto.modo, MODO_SIN_GANCHO);
  assert.equal(veredicto.ok, true, 'Una puerta no puede fallar por lo que todavía no se ha escrito');
  assert.equal(veredicto.zoom, null);
  assert.match(veredicto.mensaje, /todavía no se puede certificar/);
});

test('Con gancho y zoom legible: la puerta pasa', () => {
  const veredicto = evaluarPiso390({ existeGancho: true, zoom: 1.15 });
  assert.equal(veredicto.modo, MODO_LEGIBLE);
  assert.equal(veredicto.ok, true);
  assert.equal(veredicto.zoom, 1.15);
  assert.match(veredicto.mensaje, /piso de legibilidad 1.15/);
  assert.equal(evaluarPiso390({ existeGancho: true, zoom: 2 }).ok, true);
});

test('Con gancho y zoom por debajo del piso: la puerta falla', () => {
  const veredicto = evaluarPiso390({ existeGancho: true, zoom: 0.45 });
  assert.equal(veredicto.modo, MODO_ILEGIBLE);
  assert.equal(veredicto.ok, false);
  assert.equal(veredicto.zoom, 0.45);
  assert.match(veredicto.mensaje, /piso de legibilidad es 1.15/);
  assert.equal(evaluarPiso390({ existeGancho: true, zoom: 1.1499 }).ok, false, 'Justo por debajo también falla');
});

test('Con gancho y zoom que no se puede leer como número: la puerta falla', () => {
  for (const zoom of [null, undefined, '1,15', Number.NaN, Infinity, {}]) {
    const veredicto = evaluarPiso390({ existeGancho: true, zoom });
    assert.equal(veredicto.modo, MODO_SIN_ZOOM, `zoom ${String(zoom)}`);
    assert.equal(veredicto.ok, false, `zoom ${String(zoom)}`);
    assert.equal(veredicto.zoom, null);
    assert.match(veredicto.mensaje, /no se pudo leer como número/);
  }
});

test('Con gancho que apunta a otro diagrama: la puerta falla', () => {
  const veredicto = evaluarPiso390({
    existeGancho: true,
    zoom: 1.4,
    proceso: 'otro_proceso',
    procesoEsperado: 'proceso_pedido',
  });
  assert.equal(veredicto.modo, MODO_OTRO_DIAGRAMA);
  assert.equal(veredicto.ok, false);
  assert.match(veredicto.mensaje, /otro_proceso/);
});

test('Con gancho que apunta al diagrama pedido: la puerta no lo confunde', () => {
  const veredicto = evaluarPiso390({
    existeGancho: true,
    zoom: 1.4,
    proceso: 'proceso_pedido',
    procesoEsperado: 'proceso_pedido',
  });
  assert.equal(veredicto.modo, MODO_LEGIBLE);
  assert.equal(veredicto.ok, true);
});

test('La lectura en la página solo reconoce los ganchos que existen', () => {
  const leer = (ventana) => leerEstadoLienzo(ventana);
  assert.deepEqual(leer({}), { existeGancho: false, zoom: null, proceso: null, modo: null, paso: null });
  assert.deepEqual(
    leer({ __rrAtlasZoom: 1.15 }),
    { existeGancho: true, zoom: 1.15, proceso: null, modo: null, paso: null },
  );
  assert.deepEqual(
    leer({ __rrAtlasBpmn: { estado: () => ({ zoom: 1.2, proceso: 'p1' }) } }),
    { existeGancho: true, zoom: 1.2, proceso: 'p1', modo: null, paso: null },
  );
  // El gancho que existe pero no dice nada: la puerta falla (no se puede leer).
  assert.deepEqual(
    leer({ __rrAtlasBpmn: { estado: () => ({}) } }),
    { existeGancho: true, zoom: null, proceso: null, modo: null, paso: null },
  );
  // Un gancho que lanza al leer el estado tampoco puede certificar nada.
  assert.deepEqual(
    leer({ __rrAtlasBpmn: { estado: () => { throw new Error('roto'); } } }),
    { existeGancho: true, zoom: null, proceso: null, modo: null, paso: null },
  );
  // El workspace pelado (lo que hay hoy) no es un gancho de estado.
  assert.deepEqual(
    leer({ __rrAtlasBpmn: { get: () => null } }),
    { existeGancho: false, zoom: null, proceso: null, modo: null, paso: null },
  );
});

test('La lectura también trae el modo de lectura y el paso actual', () => {
  const paso = { indice: 0, total: 14, idElemento: 'e_ini', nombre: 'Llega un documento', carril: 'Equipo RR', nota: '' };
  const lectura = leerEstadoLienzo({
    __rrAtlasBpmn: { estado: () => ({ zoom: 1.15, proceso: 'gobierno', modo: 'paso', paso }) },
  });
  assert.equal(lectura.modo, 'paso');
  assert.deepEqual(lectura.paso, paso);
});

test('El conjunto falla si NINGÚN diagrama tiene gancho (el bloque 1B lo exige)', () => {
  const sinGancho = evaluarPiso390({ existeGancho: false, zoom: null });
  const conjunto = evaluarConjunto390([sinGancho, sinGancho]);
  assert.equal(conjunto.ok, false, 'en el bloque 1B el gancho tiene que existir');
  assert.equal(conjunto.sinGancho, 2);
  assert.equal(conjunto.diagramas, 2);
  assert.match(conjunto.mensaje, /el gancho tiene que existir/);
});

test('El conjunto pasa si algún diagrama tiene gancho', () => {
  const legible = evaluarPiso390({ existeGancho: true, zoom: 1.15 });
  const sinGancho = evaluarPiso390({ existeGancho: false, zoom: null });
  const conjunto = evaluarConjunto390([legible, sinGancho]);
  assert.equal(conjunto.ok, true);
  assert.equal(conjunto.sinGancho, 1);
  assert.match(conjunto.mensaje, /1 de 2 diagramas sin gancho/);
});

test('El conjunto vacío no falla (no hay diagramas que certificar)', () => {
  const conjunto = evaluarConjunto390([]);
  assert.equal(conjunto.ok, true);
  assert.equal(conjunto.diagramas, 0);
});
