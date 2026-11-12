import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  BANDERAS_PREFS,
  CLAVE_PREFS,
  OVERRIDE_SEGURO,
  PREFERENCIAS_POR_DEFECTO,
  VERSION_PREFS,
  escribirPreferencias,
  fijarOverrideSesion,
  leerPreferencias,
  marcarAvisoVisto,
  marcarGuiaVista,
  obtenerPreferenciasVigentes,
  overrideDesdeQuery,
  puedeAbrirGuiaAuto,
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
  // El override de sesión es memoria del módulo: se quita entre pruebas.
  fijarOverrideSesion(null);
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

// ── El override de sesión (bloque 1B) ─────────────────────────────────────

test('Sin override, las preferencias vigentes son las guardadas', () => {
  assert.equal(escribirPreferencias({ modoPaso: false }), true);
  assert.deepEqual(obtenerPreferenciasVigentes(), leerPreferencias());
  assert.equal(obtenerPreferenciasVigentes().modoPaso, false);
});

test('El override de sesión manda sobre lo guardado y no escribe nada', () => {
  assert.equal(escribirPreferencias({ modoPaso: true }), true);
  fijarOverrideSesion({ modoPaso: false });
  assert.equal(obtenerPreferenciasVigentes().modoPaso, false, 'El override manda');
  assert.equal(leerPreferencias().modoPaso, true, 'Lo guardado no se toca');
  assert.equal(almacen.length, 1, 'El override no escribe ninguna clave nueva');
  assert.equal(almacen.getItem(CLAVE_PREFS) !== null, true, 'La clave guardada sigue ahí');
  fijarOverrideSesion(null);
  assert.equal(obtenerPreferenciasVigentes().modoPaso, true, 'Sin override manda lo guardado');
});

test('El override se puede quitar y vuelve a mandar lo guardado', () => {
  escribirPreferencias({ copiador: false });
  fijarOverrideSesion({ copiador: true });
  assert.equal(obtenerPreferenciasVigentes().copiador, true);
  assert.equal(fijarOverrideSesion(null), null);
  assert.equal(obtenerPreferenciasVigentes().copiador, false);
});

test('El override puede volver a encender una preferencia apagada', () => {
  escribirPreferencias({ modoPaso: false });
  fijarOverrideSesion({ modoPaso: true });
  assert.equal(obtenerPreferenciasVigentes().modoPaso, true);
  assert.equal(leerPreferencias().modoPaso, false, 'Lo guardado sigue apagado');
});

test('El override solo acepta banderas booleanas y la lista de avisos', () => {
  fijarOverrideSesion({
    modoPaso: false,
    legibilidad: 'no',
    copiador: 1,
    guiaVista: true,
    avisosVistos: ['1.0', 42, null],
    otraCosa: 'ignorada',
  });
  const vigentes = obtenerPreferenciasVigentes();
  assert.equal(vigentes.modoPaso, false);
  assert.equal(vigentes.legibilidad, true, 'Un valor que no es booleano se ignora');
  assert.equal(vigentes.copiador, true);
  assert.equal(vigentes.guiaVista, true);
  assert.deepEqual(vigentes.avisosVistos, ['1.0'], 'La lista solo guarda versiones de texto');
  assert.equal(vigentes.otraCosa, undefined, 'Una clave que no es del contrato no se cuela');
});

test('El override se fusiona: no borra las banderas que no se mencionan', () => {
  fijarOverrideSesion({ modoPaso: false });
  fijarOverrideSesion({ guiaVista: true });
  const vigentes = obtenerPreferenciasVigentes();
  assert.equal(vigentes.modoPaso, false, 'La bandera anterior sigue puesta');
  assert.equal(vigentes.guiaVista, true);
});

test('Un override que no es un objeto no rompe nada', () => {
  for (const raro of ['texto', 42, [], true]) {
    fijarOverrideSesion(raro);
    assert.equal(obtenerPreferenciasVigentes().modoPaso, true, `Override ${String(raro)}`);
  }
});

test('Sin localStorage, las preferencias vigentes son las de fábrica', () => {
  delete globalThis.localStorage;
  assert.deepEqual(obtenerPreferenciasVigentes(), {
    modoPaso: true,
    legibilidad: true,
    copiador: true,
    guiaVista: false,
    avisosVistos: [],
  });
});

test('Volver a los valores de fábrica borra la clave versionada', () => {
  escribirPreferencias({ modoPaso: false, copiador: false });
  assert.equal(almacen.getItem(CLAVE_PREFS) !== null, true);
  assert.equal(restablecerPreferencias(), true);
  assert.equal(almacen.getItem(CLAVE_PREFS), null);
  assert.equal(preferencia('modoPaso'), true);
  assert.equal(preferencia('copiador'), true);
});

// ── El apagado de emergencia por URL (bloque 1B · ítem 67) ───────────────

test('Una URL que no pide el modo seguro no pide nada', () => {
  assert.equal(overrideDesdeQuery(''), null);
  assert.equal(overrideDesdeQuery('?'), null);
  assert.equal(overrideDesdeQuery('?atlas=completo'), null);
  assert.equal(overrideDesdeQuery('?atlas='), null);
  assert.equal(overrideDesdeQuery('?atlas=seguro2'), null);
  assert.equal(overrideDesdeQuery('?otro=seguro'), null);
  assert.equal(overrideDesdeQuery('#/bpmn'), null, 'Un hash no es una query');
});

test('Una query que no es texto no rompe nada', () => {
  for (const raro of [undefined, null, 42, true, {}, []]) {
    assert.equal(overrideDesdeQuery(raro), null, `Query ${String(raro)}`);
  }
});

test('?atlas=seguro devuelve el override de emergencia', () => {
  const esperado = { modoPaso: false, copiador: false, guiaVista: true };
  assert.deepEqual(overrideDesdeQuery('?atlas=seguro'), esperado);
  assert.deepEqual(overrideDesdeQuery('atlas=seguro'), esperado, 'El «?» es opcional');
  assert.deepEqual(overrideDesdeQuery('?foo=1&atlas=seguro&bar=2'), esperado, 'Va con otros parámetros');
  assert.deepEqual(overrideDesdeQuery(new URLSearchParams('atlas=seguro')), esperado, 'También acepta URLSearchParams');
  assert.deepEqual(OVERRIDE_SEGURO, esperado);
});

test('El override de emergencia no toca la legibilidad', () => {
  const override = overrideDesdeQuery('?atlas=seguro');
  assert.equal(Object.hasOwn(override, 'legibilidad'), false, 'El piso de 1,15 no se apaga');
  assert.deepEqual(Object.keys(override).sort(), ['copiador', 'guiaVista', 'modoPaso']);
});

test('El override de emergencia devuelve un objeto nuevo cada vez', () => {
  const uno = overrideDesdeQuery('?atlas=seguro');
  uno.modoPaso = true;
  uno.avisosVistos = ['1.0'];
  const otro = overrideDesdeQuery('?atlas=seguro');
  assert.equal(otro.modoPaso, false, 'Cambiar el resultado no cambia el siguiente');
  assert.equal(Object.hasOwn(otro, 'avisosVistos'), false);
});

test('El override de emergencia no escribe nada en el almacén', () => {
  const override = overrideDesdeQuery('?atlas=seguro');
  assert.equal(almacen.length, 0, 'La función es pura: no deja rastro');
  // Y lo que se aplica en memoria tampoco escribe:
  fijarOverrideSesion(override);
  assert.equal(almacen.length, 0, 'El override de sesión tampoco escribe');
  assert.equal(leerPreferencias().modoPaso, true, 'Lo guardado sigue como estaba');
});

test('Con el override de emergencia, la guía automática no se abre', () => {
  assert.equal(puedeAbrirGuiaAuto(), true, 'Sin override, la guía puede abrirse sola');
  fijarOverrideSesion(overrideDesdeQuery('?atlas=seguro'));
  assert.equal(puedeAbrirGuiaAuto(), false, 'En modo seguro la guía no se abre sola');
  assert.equal(marcarGuiaVista(), true);
  assert.equal(puedeAbrirGuiaAuto(), false, 'Con la guía vista, tampoco se abre sola');
});
