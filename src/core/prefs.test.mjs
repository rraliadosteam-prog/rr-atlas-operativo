import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  BANDERAS_PREFS,
  CLAVE_PREFS,
  PREFERENCIAS_POR_DEFECTO,
  VERSION_PREFS,
  escribirPreferencias,
  leerPreferencias,
  marcarAvisoVisto,
  marcarGuiaVista,
  preferencia,
  restablecerPreferencias,
} from './prefs.mjs';

// Un `localStorage` de mentira: el módulo no tiene DOM y sus pruebas son
// sobre datos, no sobre la interfaz.
function almacenFalso() {
  const datos = new Map();
  return {
    datos,
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => { datos.set(clave, String(valor)); },
    removeItem: (clave) => { datos.delete(clave); },
    get length() { return datos.size; },
  };
}

let almacen;
let original;

beforeEach(() => {
  almacen = almacenFalso();
  original = globalThis.localStorage;
  globalThis.localStorage = almacen;
});

afterEach(() => {
  if (original === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = original;
});

test('La clave es versionada: rr-atlas:prefs:v1', () => {
  assert.equal(CLAVE_PREFS, 'rr-atlas:prefs:v1');
  assert.equal(VERSION_PREFS, 1);
});

test('Sin nada guardado, cada bandera tiene su valor por defecto', () => {
  assert.equal(preferencia('modoPaso'), true);
  assert.equal(preferencia('legibilidad'), true);
  assert.equal(preferencia('copiador'), true);
  assert.equal(preferencia('guiaVista'), false);
  assert.deepEqual(preferencia('avisosVistos'), []);
  assert.deepEqual(BANDERAS_PREFS, ['modoPaso', 'legibilidad', 'copiador', 'guiaVista']);
  assert.deepEqual(PREFERENCIAS_POR_DEFECTO, {
    modoPaso: true,
    legibilidad: true,
    copiador: true,
    guiaVista: false,
    avisosVistos: [],
  });
});

test('Leer no escribe nada en el almacén', () => {
  leerPreferencias();
  preferencia('modoPaso');
  assert.equal(almacen.length, 0, 'Leer no deja rastro');
  assert.equal(almacen.getItem(CLAVE_PREFS), null);
});

test('modoPaso apagado devuelve false y no toca las demás banderas', () => {
  assert.equal(escribirPreferencias({ modoPaso: false }), true);
  assert.equal(preferencia('modoPaso'), false);
  assert.equal(preferencia('legibilidad'), true);
  assert.equal(preferencia('copiador'), true);
  assert.equal(preferencia('guiaVista'), false);
});

test('legibilidad apagada devuelve false (vuelve al encuadre viejo)', () => {
  assert.equal(escribirPreferencias({ legibilidad: false }), true);
  assert.equal(preferencia('legibilidad'), false);
  assert.equal(preferencia('modoPaso'), true);
});

test('copiador apagado devuelve false (no se ofrece «Compartir»)', () => {
  assert.equal(escribirPreferencias({ copiador: false }), true);
  assert.equal(preferencia('copiador'), false);
  assert.equal(preferencia('modoPaso'), true);
});

test('guiaVista solo se escribe al cerrar la guía', () => {
  escribirPreferencias({ modoPaso: false });
  assert.equal(preferencia('guiaVista'), false, 'Abrir la app no marca la guía como vista');
  assert.equal(marcarGuiaVista(), true);
  assert.equal(preferencia('guiaVista'), true);
});

test('avisosVistos es una lista: vacía al empezar, y se escribe al marcar una versión', () => {
  assert.deepEqual(preferencia('avisosVistos'), []);
  leerPreferencias();
  assert.equal(almacen.getItem(CLAVE_PREFS), null, 'Leer no escribe la lista');
  assert.equal(marcarAvisoVisto('1.0'), true);
  assert.deepEqual(preferencia('avisosVistos'), ['1.0']);
  assert.equal(marcarAvisoVisto('1.1'), true);
  assert.deepEqual(preferencia('avisosVistos'), ['1.0', '1.1']);
  assert.equal(marcarAvisoVisto('1.1'), true);
  assert.deepEqual(preferencia('avisosVistos'), ['1.0', '1.1'], 'Marcar dos veces la misma versión no la duplica');
  assert.equal(marcarAvisoVisto(''), false, 'Una versión vacía no se marca');
});

test('Una clave de otra versión se ignora y se usan los valores por defecto', () => {
  almacen.setItem('rr-atlas:prefs:v2', JSON.stringify({ version: 2, modoPaso: false }));
  assert.equal(preferencia('modoPaso'), true, 'La clave de otra versión no se lee');
  almacen.setItem(CLAVE_PREFS, JSON.stringify({ version: 2, modoPaso: false }));
  assert.equal(preferencia('modoPaso'), true, 'Un payload de otra versión dentro de la clave tampoco se lee');
  assert.deepEqual(preferencia('avisosVistos'), []);
});

test('Lo guardado con ruido se lee solo lo que tiene el tipo correcto', () => {
  almacen.setItem(CLAVE_PREFS, JSON.stringify({
    version: 1,
    modoPaso: 'no',
    legibilidad: false,
    copiador: true,
    guiaVista: true,
    avisosVistos: ['1.0', 42, null],
    otraCosa: 'ignorada',
  }));
  const preferencias = leerPreferencias();
  assert.equal(preferencias.modoPaso, true, 'Un valor que no es booleano se ignora');
  assert.equal(preferencias.legibilidad, false);
  assert.equal(preferencias.guiaVista, true);
  assert.deepEqual(preferencias.avisosVistos, ['1.0'], 'La lista solo guarda versiones de texto');
  assert.equal(preferencias.otraCosa, undefined);
});

test('Sin localStorage nada lanza y no se escribe nada', () => {
  delete globalThis.localStorage;
  assert.deepEqual(leerPreferencias(), {
    modoPaso: true,
    legibilidad: true,
    copiador: true,
    guiaVista: false,
    avisosVistos: [],
  });
  assert.equal(preferencia('modoPaso'), true);
  assert.equal(escribirPreferencias({ modoPaso: false }), false);
  assert.equal(marcarGuiaVista(), false);
  assert.equal(marcarAvisoVisto('1.0'), false);
  assert.equal(restablecerPreferencias(), false);
});

test('Un almacén que falla al escribir no rompe la app', () => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('cuota llena'); },
    removeItem: () => { throw new Error('cuota llena'); },
  };
  assert.equal(escribirPreferencias({ modoPaso: false }), false);
  assert.equal(preferencia('modoPaso'), true, 'Se queda en el valor por defecto');
});

test('Una clave con texto roto no rompe la app', () => {
  almacen.setItem(CLAVE_PREFS, '{esto no es json');
  assert.equal(preferencia('modoPaso'), true);
  assert.deepEqual(leerPreferencias().avisosVistos, []);
});

test('Volver a los valores de fábrica borra la clave versionada', () => {
  escribirPreferencias({ modoPaso: false, copiador: false });
  assert.equal(almacen.getItem(CLAVE_PREFS) !== null, true);
  assert.equal(restablecerPreferencias(), true);
  assert.equal(almacen.getItem(CLAVE_PREFS), null);
  assert.equal(preferencia('modoPaso'), true);
  assert.equal(preferencia('copiador'), true);
});
