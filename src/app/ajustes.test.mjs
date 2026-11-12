// El interruptor visible y el apagado de emergencia (bloque 3 · ítems 67 y
// 68 · P1.11).
//
//   node --test src/app/ajustes.test.mjs
//
// Lo que se comprueba aquí es el **contrato de las marcas**: que el diálogo
// «Ajustes» existe con sus cuatro interruptores, que el aviso del modo
// seguro tiene su sitio, que los estilos usan tokens de marca y objetivos
// táctiles de 44 px, y que el apagado de emergencia no escribe nada.
//
// Lo que esta prueba **no** puede hacer (necesita un navegador) se dice al
// final: que el diálogo abra de verdad, que los interruptores guarden y que
// la banda desaparezca al apagar el modo paso. Eso lo comprueba
// `src/app/rr-tree-view.test.mjs` (con Chrome) y las puertas
// `scripts/verificar-movil.mjs` y `scripts/verificar-tactil.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const HTML = readFileSync(resolve(RAIZ, 'index.html'), 'utf8');
const CSS = readFileSync(resolve(RAIZ, 'src', 'styles', 'rr-tree.css'), 'utf8');
const ARBOL = readFileSync(resolve(RAIZ, 'src', 'app', 'rr-tree.mjs'), 'utf8');
const BPMN = readFileSync(resolve(RAIZ, 'src', 'app', 'bpmn-view.mjs'), 'utf8');

// ── El diálogo «Ajustes» ─────────────────────────────────────────────────

test('El botón «Ajustes» está junto al botón «Guía» de la barra superior', () => {
  const guia = HTML.indexOf('data-action="help"');
  const ajustes = HTML.indexOf('data-action="ajustes"');
  assert.ok(guia > 0, 'El botón «Guía» existe');
  assert.ok(ajustes > guia, 'El botón «Ajustes» viene después del «Guía»');
  assert.ok(ajustes - guia < 400, 'El botón «Ajustes» está al lado, no al final de la barra');
  assert.match(HTML, /data-action="ajustes"[^>]*>Ajustes</, 'El botón se llama «Ajustes»');
});

test('El diálogo «Ajustes» existe y no es un formulario (se cierra con «Listo»)', () => {
  assert.match(HTML, /<dialog class="ajustes-dialog" data-ajustes/, 'El diálogo existe con su marca');
  assert.doesNotMatch(HTML, /<dialog class="ajustes-dialog"[^>]*>[\s\S]{0,400}<form/, 'El diálogo no es un formulario');
  assert.match(HTML, /data-ajustes-listo[^>]*>Listo</, 'Se cierra con «Listo»');
  assert.match(HTML, /data-ajustes-fabrica[^>]*>[^<]*Volver a los valores de fábrica/, 'Hay botón «Volver a los valores de fábrica»');
  assert.match(HTML, /data-ajustes-estado[^>]*>Guardado en este navegador</, 'El estado dice «Guardado en este navegador»');
});

test('Hay un interruptor por bandera booleana: cuatro, y `avisosVistos` no lleva ninguno', () => {
  const interruptores = [...HTML.matchAll(/data-pref="([^"]+)"/g)].map((coincidencia) => coincidencia[1]);
  assert.deepEqual(interruptores, ['modoPaso', 'legibilidad', 'copiador', 'guiaVista']);
  assert.equal(interruptores.includes('avisosVistos'), false, 'La lista no lleva interruptor');
  for (const bandera of interruptores) {
    const regla = new RegExp(`data-pref="${bandera}"`);
    assert.ok(regla.test(HTML), `El interruptor de ${bandera} existe`);
  }
});

test('Los interruptores son role="switch" con aria-checked y etiqueta en español', () => {
  const filas = [...HTML.matchAll(/<button class="interruptor"[^>]*>/g)].map((coincidencia) => coincidencia[0]);
  assert.equal(filas.length, 4, 'Los cuatro interruptores son botones');
  for (const fila of filas) {
    assert.match(fila, /role="switch"/, 'role="switch"');
    assert.match(fila, /aria-checked="(true|false)"/, 'El estado se lee con aria-checked');
    assert.match(fila, /aria-labelledby="ajustes-etiqueta-[^"]+"/, 'La etiqueta está en español');
    assert.match(fila, /aria-describedby="ajustes-explica-[^"]+"/, 'Cada uno explica qué hace');
  }
  assert.match(HTML, /id="ajustes-etiqueta-modo-paso">Modo paso</, 'Etiqueta: «Modo paso»');
  assert.match(HTML, /id="ajustes-etiqueta-legibilidad">Legibilidad</, 'Etiqueta: «Legibilidad»');
  assert.match(HTML, /id="ajustes-etiqueta-copiador">Copiar y compartir</, 'Etiqueta: «Copiar y compartir»');
  assert.match(HTML, /id="ajustes-etiqueta-guiaVista">Ya vi la guía</, 'Etiqueta: «Ya vi la guía»');
});

test('El diálogo dice que el piso de legibilidad 1,15 sigue activo siempre', () => {
  const nota = HTML.match(/<p class="ajustes-nota">([\s\S]*?)<\/p>/);
  assert.ok(nota, 'Hay una nota sobre el mínimo de lectura');
  assert.match(nota[1], /1,15/, 'La nota dice el número del piso');
  assert.match(nota[1], /no se apaga/, 'La nota dice que no se apaga');
});

// ── El aviso del modo seguro ─────────────────────────────────────────────

test('El aviso del modo seguro tiene su marca y su texto', () => {
  assert.match(HTML, /data-atlas-seguro[^>]*>Modo seguro \(solo este enlace\)<\/p>/, 'El aviso dice «Modo seguro (solo este enlace)»');
  assert.match(HTML, /data-atlas-seguro hidden/, 'El aviso nace oculto: solo se ve si el modo seguro está activo');
});

test('El arranque aplica el override de la URL sin escribir en el almacén', () => {
  assert.match(ARBOL, /overrideDesdeQuery\(location\.search\)/, 'La query se lee al arrancar');
  assert.match(ARBOL, /fijarOverrideSesion\(overrideSeguro\)/, 'El override se fija en memoria');
  assert.doesNotMatch(ARBOL, /escribirPreferencias\([^)]*overrideSeguro/, 'El modo seguro no escribe nada');
  assert.match(ARBOL, /avisoSeguro\.hidden = false/, 'El aviso se muestra con el modo seguro');
});

// ── Los estilos ──────────────────────────────────────────────────────────

test('El interruptor mide 44 px de alto', () => {
  const regla = CSS.match(/\.interruptor \{[^}]*\}/);
  assert.ok(regla, 'Hay regla para el interruptor');
  assert.match(regla[0], /height: 44px/, 'El interruptor mide 44 px de alto');
  assert.match(regla[0], /min-height: 44px/, 'Y 44 px como mínimo');
});

test('Los estilos del interruptor usan tokens de marca, no colores literales', () => {
  const bloque = CSS.match(/\/\* Bloque 3 · el diálogo «Ajustes»[\s\S]*?\.interruptor\[disabled\][^}]*\}/);
  assert.ok(bloque, 'Existe el bloque de estilos del bloque 3');
  assert.doesNotMatch(bloque[0], /#[0-9a-f]{3,8}\b/i, 'No hay colores literales: solo tokens');
  for (const token of ['var(--fuchsia)', 'var(--cream)']) {
    assert.ok(bloque[0].includes(token), `Usa ${token}`);
  }
});

// ── El contrato con la vista BPMN ────────────────────────────────────────

test('Cambiar un interruptor guarda y avisa con el evento «rr-atlas:prefs»', () => {
  assert.match(ARBOL, /escribirPreferencias\(\{ \[bandera\]: siguiente \}\)/, 'Cambiar un interruptor llama escribirPreferencias');
  assert.match(ARBOL, /new CustomEvent\('rr-atlas:prefs'/, 'Se emite el evento «rr-atlas:prefs»');
  assert.match(BPMN, /addEventListener\('rr-atlas:prefs'/, 'La vista BPMN escucha el evento');
  assert.match(BPMN, /fit\?\.\(\{ modo: 'todo'/, 'Al apagar el modo paso el diagrama pasa a «ver el todo»');
});

test('Lo que esta prueba no puede hacer (necesita un navegador)', () => {
  assert.ok(true, 'Que el diálogo abra, que los interruptores guarden y que la banda desaparezca lo comprueba src/app/rr-tree-view.test.mjs con Chrome.');
});
