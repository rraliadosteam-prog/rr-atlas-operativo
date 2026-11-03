import { test } from 'node:test';
import assert from 'node:assert/strict';

import { COLECCIONES } from '../core/model.mjs';
import { crearStore } from '../core/store.mjs';
import { BASE } from '../data/base/index.mjs';
import {
  TITULOS_COLECCION,
  describirDiff,
  resumenColecciones,
  resumirFuentes,
  textoCambio,
} from './datos-view.mjs';

test('el resumen de la vista Datos trae las once colecciones del esquema v5', () => {
  const resumen = resumenColecciones(BASE);
  assert.equal(resumen.length, COLECCIONES.length);
  for (const fila of resumen) {
    assert.ok(TITULOS_COLECCION[fila.coleccion], `falta el título de ${fila.coleccion}`);
    assert.equal(typeof fila.total, 'number');
  }
  const procesos = resumen.find((fila) => fila.coleccion === 'proceso');
  assert.ok(procesos.total >= 40, 'el catálogo de procesos está incompleto');
});

test('el diff se describe en palabras: qué entra, qué sale y qué se toca', () => {
  const descritos = describirDiff([
    { coleccion: 'cliente', id: 'cliente-boga', tipo: 'cambiado', campos: ['estado'] },
    { coleccion: 'area', id: 'area-nueva', tipo: 'nuevo', campos: ['nombre'] },
    { coleccion: 'rol', id: 'rol-viejo', tipo: 'quitado', campos: [] },
  ]);
  assert.equal(descritos.length, 3);
  assert.equal(descritos[0].etiqueta, 'se toca');
  assert.equal(descritos[1].etiqueta, 'entra');
  assert.equal(descritos[2].etiqueta, 'sale');
  assert.match(textoCambio(descritos[0]), /se toca: Clientes · cliente-boga · estado/);
});

test('las fuentes y los cortes se listan sin perder ninguno', () => {
  const fuentes = resumirFuentes(BASE);
  assert.ok(fuentes.length > 3, 'hay muy pocas fuentes');
  for (const fila of fuentes) {
    assert.ok(fila.fuente.length > 0);
    assert.ok(fila.corte.length > 0);
    assert.ok(fila.registros > 0);
  }
  const total = fuentes.reduce((suma, fila) => suma + fila.registros, 0);
  const esperado = COLECCIONES.reduce((suma, coleccion) => suma + BASE[coleccion].length, 0);
  assert.equal(total, esperado, 'la lista de fuentes no cubre todos los registros');
});

test('el store de la vista Datos arranca en la base, sin cambios y validando', () => {
  const store = crearStore({ base: BASE });
  const estado = store.estado();
  assert.deepEqual(estado.diff, []);
  assert.equal(estado.schemaVersion, 5);
  const reporte = store.validar();
  assert.equal(reporte.ok, true, `errores: ${JSON.stringify(reporte.errores)}`);
});

test('exportar e importar desde la vista Datos es idempotente', () => {
  const store = crearStore({ base: BASE });
  const paquete = store.exportar();
  store.aplicar('cliente', 'cliente-boga', { estado: 'activo' });
  const conCambios = store.exportar();
  store.importar(conCambios);
  const repetido = store.exportar();
  assert.deepEqual(repetido, conCambios);
  assert.equal(repetido.schemaVersion, 5);
});
