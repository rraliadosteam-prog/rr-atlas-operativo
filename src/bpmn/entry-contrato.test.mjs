// El contrato del motor BPMN, comprobado **sin navegador**.
//
//   node --test src/bpmn/entry-contrato.test.mjs
//
// `src/bpmn/entry.mjs` no se puede importar en Node: sus imports de
// `bpmn-js` no llevan extensión y los resuelve el empaquetador (esbuild),
// no Node. Por eso esta prueba lee el **código** del motor y afirma lo que
// el diseño v3.1 (ítem 3 · P1.2) deja por escrito:
//
// · el motor no repite las constantes de zoom: las pide a
//   `src/core/zoom.mjs` (la única fuente, del bloque 1A);
// · el contrato de `fit()` es cerrado: `modo` es 'paso' o 'todo' y cualquier
//   otro valor lanza `Error('modo inválido')`;
// · la API pública de paso y de estado existe con los nombres y las claves
//   que la banda de lectura y la puerta de 390 px necesitan.
//
// Lo que esta prueba **no** puede hacer (porque necesita un navegador) se
// dice al final: el zoom real del lienzo, el desplazamiento al primer paso
// y el «−» que reduce. Eso lo miden `scripts/verificar-pulido.mjs`,
// `scripts/verificar-movil.mjs` y `scripts/verificar-tactil.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RUTA = resolve(import.meta.dirname, 'entry.mjs');
const FUENTE = readFileSync(RUTA, 'utf8');

/** El código sin comentarios: los números de los comentarios no cuentan. */
const CODIGO = FUENTE
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/** Los literales de zoom que el motor ya no puede tener escritos a mano. */
const LITERALES_PROHIBIDOS = [
  { valor: '0.55', motivo: 'el piso manual viejo del motor (bug B2)' },
  { valor: '0.2', motivo: 'el piso manual del motor en lienzo ancho' },
  { valor: '2.6', motivo: 'el techo del zoom del diagrama' },
  { valor: '1.15', motivo: 'el piso de legibilidad del diagrama' },
  { valor: '0.94', motivo: 'el margen del encuadre' },
];

test('El motor no repite ninguna constante de zoom: las pide al módulo', () => {
  for (const { valor, motivo } of LITERALES_PROHIBIDOS) {
    const patron = new RegExp(`(?<![\\d.])${valor.replace('.', '\\.')}(?![\\d])`);
    assert.equal(
      patron.test(CODIGO),
      false,
      `El motor no debe escribir el literal ${valor} (${motivo}): lo pide a src/core/zoom.mjs`,
    );
  }
});

test('El motor importa los pisos, el margen y el techo de src/core/zoom.mjs', () => {
  assert.match(FUENTE, /from '\.\.\/core\/zoom\.mjs'/);
  for (const constante of [
    'MARGEN_ENCUADRE',
    'PISO_LEGIBILIDAD_DIAGRAMA',
    'PISO_ZOOM_MANUAL_MOTOR',
    'ZOOM_MAXIMO',
    'esLienzoAngosto',
    'pisoManualMotor',
  ]) {
    assert.match(FUENTE, new RegExp(`\\b${constante}\\b`), `Falta usar ${constante}`);
  }
  // Y usa las funciones puras del módulo (el cálculo del zoom no se
  // reescribe en el motor).
  assert.match(FUENTE, /\bzoomEncuadre\(/);
  assert.match(FUENTE, /\bzoomManual\(/);
});

test('El contrato de fit() es cerrado: un modo inválido es un error', () => {
  assert.match(FUENTE, /modo inválido/);
  // La función es pura: se puede sacar del archivo y probarla sola.
  const opcionesDeFit = extraer('opcionesDeFit');
  assert.equal(opcionesDeFit({}).modo, 'todo');
  assert.equal(opcionesDeFit({ modo: 'paso' }).modo, 'paso');
  assert.equal(opcionesDeFit({ modo: 'todo' }).modo, 'todo');
  assert.equal(opcionesDeFit({ completo: true }).modo, 'todo');
  assert.equal(opcionesDeFit({ forzar: true }).forzar, true);
  assert.equal(opcionesDeFit({ modo: 'paso', forzar: true }).forzar, true);
  assert.throws(() => opcionesDeFit({ modo: 'completo' }), /modo inválido/);
  assert.throws(() => opcionesDeFit({ modo: '' }), /modo inválido/);
  assert.throws(() => opcionesDeFit({ modo: 7 }), /modo inválido/);
});

test('El motor expone la API de paso y la de estado que pide P1.2', () => {
  const definiciones = {
    pasoActual: { definicion: /function pasoActual\(/, publica: /^\s{4}pasoActual,?$/m },
    irAPaso: { definicion: /function irAPaso\(/, publica: /^\s{4}irAPaso,?$/m },
    estado: { definicion: /^\s{4}estado\(\) \{/m, publica: /^\s{4}estado\(\) \{/m },
  };
  for (const [nombre, { definicion, publica }] of Object.entries(definiciones)) {
    assert.match(FUENTE, definicion, `Falta ${nombre}()`);
    assert.match(FUENTE, publica, `${nombre}() no está en la API pública`);
  }
  // El descriptor del paso tiene exactamente las seis claves del contrato.
  const descriptor = /function describirPaso[\s\S]*?return \{([\s\S]*?)\};/.exec(FUENTE);
  assert.ok(descriptor, 'No se encontró el descriptor del paso');
  for (const clave of ['indice', 'total', 'idElemento', 'nombre', 'carril', 'nota']) {
    assert.match(descriptor[1], new RegExp(`\\b${clave}\\b`), `El descriptor no trae ${clave}`);
  }
  // Y el estado trae las seis claves del contrato.
  const estado = /estado\(\) \{[\s\S]*?return \{([\s\S]*?)\};/.exec(FUENTE);
  assert.ok(estado, 'No se encontró el estado');
  for (const clave of ['zoom', 'anchoContenedor', 'proceso', 'paso', 'modo', 'origen']) {
    assert.match(estado[1], new RegExp(`\\b${clave}\\b`), `El estado no trae ${clave}`);
  }
});

test('La nota del paso sale de la documentación, sin inventar texto', () => {
  // La nota se separa con `separarNotas()` (las líneas «Fuente:» y «Corte:»
  // no son la nota) y, si no hay nada, la nota es una cadena vacía.
  assert.match(FUENTE, /separarNotas\(/);
  assert.match(FUENTE, /notaDe/);
  assert.match(FUENTE, /notas \|\| ''/);
});

test('nudgeLabels no escribe en el modelo (P1.3): la etiqueta se mueve en el gfx', () => {
  const nudge = /function nudgeLabels\(\)[\s\S]*?\n  \}/.exec(FUENTE);
  assert.ok(nudge, 'No se encontró nudgeLabels');
  assert.doesNotMatch(nudge[0], /label\.y\s*=/, 'nudgeLabels no debe escribir en label.y (el DI)');
  assert.match(nudge[0], /setAttribute\('transform'/, 'nudgeLabels debe mover la etiqueta en el gfx');
});

test('El motor no decide el piso del lienzo: lo pregunta al módulo', () => {
  assert.match(FUENTE, /esLienzoAngosto\(/);
  assert.doesNotMatch(CODIGO, /clientWidth\s*<\s*540/, 'El ancho del lienzo no se compara a mano');
});

/**
 * Saca una función pura del código del motor y la devuelve para poder
 * probarla en Node (el archivo entero no se puede importar).
 */
function extraer(nombre) {
  const patron = new RegExp(`export function ${nombre}\\([\\s\\S]*?\\n\\}`);
  const match = patron.exec(FUENTE);
  assert.ok(match, `No se pudo extraer ${nombre}() del motor`);
  const cuerpo = match[0].replace(/^export /, '');
  // eslint-disable-next-line no-new-func
  return new Function(`${cuerpo}\nreturn ${nombre};`)();
}
