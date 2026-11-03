// Contrato del diálogo de confirmación (P1.6 · ítem 8a).
//
// Qué afirma:
//   1. El código vivo no llama a `window.confirm` (solo queda el diálogo).
//   2. Las tres acciones que piden confirmación (borrar nodo, restaurar mapa
//      y restaurar base) usan `confirmar()` del módulo compartido.
//   3. `index.html` trae el `<dialog data-confirmar>` con título, cuerpo y
//      las dos acciones.
//   4. `confirmar()` abre el diálogo con `showModal()`, devuelve `true` al
//      aceptar y `false` al cancelar, al pulsar Escape y si no hay diálogo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { confirmar } from './confirmar.mjs';

const RAIZ = resolve(fileURLToPath(new URL('../../', import.meta.url)));

/** Quita los comentarios para no contar lo que solo se explica. */
function sinComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((linea) => linea.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

async function fuentesVivas() {
  const carpetas = ['src/app', 'src/core'];
  const archivos = [];
  for (const carpeta of carpetas) {
    for (const entrada of await readdir(resolve(RAIZ, carpeta))) {
      if (entrada.endsWith('.mjs') && !entrada.endsWith('.test.mjs')) {
        archivos.push(join(carpeta, entrada));
      }
    }
  }
  return archivos;
}

test('el código vivo no llama a window.confirm: solo hay un diálogo', async () => {
  const llamadas = [];
  for (const archivo of await fuentesVivas()) {
    const texto = sinComentarios(await readFile(resolve(RAIZ, archivo), 'utf8'));
    if (/window\s*\.\s*confirm\s*\(/.test(texto)) llamadas.push(archivo);
  }
  assert.deepEqual(llamadas, [], `quedan llamadas a window.confirm en: ${llamadas.join(', ')}`);
});

test('las tres acciones que piden confirmación usan el diálogo de la app', async () => {
  const rrTree = await readFile(resolve(RAIZ, 'src/app/rr-tree.mjs'), 'utf8');
  const datosView = await readFile(resolve(RAIZ, 'src/app/datos-view.mjs'), 'utf8');
  const rrTreeLimpio = sinComentarios(rrTree);
  const datosLimpio = sinComentarios(datosView);
  assert.equal((rrTreeLimpio.match(/await\s+confirmar\s*\(/g) ?? []).length, 2, 'faltan las dos del mapa (borrar nodo y restaurar mapa)');
  assert.equal((datosLimpio.match(/await\s+confirmar\s*\(/g) ?? []).length, 1, 'falta la de restaurar la base');
  // Los textos se conservan: los mismos que pedía la ventana nativa.
  assert.match(rrTreeLimpio, /¿Eliminar el nodo seleccionado y sus enlaces\?/);
  assert.match(rrTreeLimpio, /¿Restaurar el mapa original y descartar cambios locales\?/);
  assert.match(datosLimpio, /¿Restaurar la base del repo\? Se pierden los cambios locales de este equipo\./);
});

test('index.html trae el <dialog data-confirmar> con título, cuerpo y dos acciones', async () => {
  const html = await readFile(resolve(RAIZ, 'index.html'), 'utf8');
  assert.match(html, /<dialog[^>]*\bdata-confirmar\b/, 'no hay un <dialog data-confirmar>');
  for (const atributo of ['data-confirmar-titulo', 'data-confirmar-cuerpo', 'data-confirmar-aceptar', 'data-confirmar-cancelar']) {
    const apariciones = html.split(atributo).length - 1;
    assert.equal(apariciones, 1, `${atributo} aparece ${apariciones} veces (tiene que estar una)`);
  }
  // Los textos de la UI van en español.
  assert.match(html, /data-confirmar-cancelar[^>]*>Cancelar</);
  assert.match(html, /data-confirmar-aceptar[^>]*>Aceptar</);
});

// ─────────────────────────────────────────────────────────────────────────
// El módulo, con un DOM de mentira (Node no tiene <dialog>).
// ─────────────────────────────────────────────────────────────────────────

function crearElemento() {
  const oyentes = new Map();
  return {
    oyentes,
    textContent: '',
    addEventListener(tipo, fn) {
      if (!oyentes.has(tipo)) oyentes.set(tipo, new Set());
      oyentes.get(tipo).add(fn);
    },
    removeEventListener(tipo, fn) {
      oyentes.get(tipo)?.delete(fn);
    },
    clic() {
      for (const fn of [...(oyentes.get('click') ?? [])]) fn();
    },
  };
}

function crearDialogo() {
  const eventos = crearElemento();
  const dialogo = {
    open: false,
    titulo: crearElemento(),
    cuerpo: crearElemento(),
    aceptar: crearElemento(),
    cancelar: crearElemento(),
    querySelector(selector) {
      return {
        '[data-confirmar-titulo]': this.titulo,
        '[data-confirmar-cuerpo]': this.cuerpo,
        '[data-confirmar-aceptar]': this.aceptar,
        '[data-confirmar-cancelar]': this.cancelar,
      }[selector] ?? null;
    },
    showModal() { this.open = true; },
    close() {
      this.open = false;
      for (const fn of [...(eventos.oyentes?.get('close') ?? [])]) fn();
    },
  };
  dialogo.addEventListener = eventos.addEventListener.bind(eventos);
  dialogo.removeEventListener = eventos.removeEventListener.bind(eventos);
  dialogo.oyentes = eventos;
  return dialogo;
}

/** Engancha un `document` de mentira y devuelve la función para soltarlo. */
function usarDocumento(dialogo) {
  const anterior = globalThis.document;
  globalThis.document = {
    querySelector(selector) {
      return selector === '[data-confirmar]' ? (dialogo ?? null) : null;
    },
  };
  return () => {
    if (anterior === undefined) delete globalThis.document;
    else globalThis.document = anterior;
  };
}

test('confirmar() abre el diálogo, escribe el texto y devuelve true al aceptar', async () => {
  const dialogo = crearDialogo();
  const soltar = usarDocumento(dialogo);
  try {
    const promesa = confirmar({ titulo: 'Eliminar el nodo', cuerpo: '¿Eliminar?', aceptar: 'Eliminar', cancelar: 'Cancelar' });
    assert.equal(dialogo.open, true, 'el diálogo no se abrió con showModal()');
    assert.equal(dialogo.titulo.textContent, 'Eliminar el nodo');
    assert.equal(dialogo.cuerpo.textContent, '¿Eliminar?');
    assert.equal(dialogo.aceptar.textContent, 'Eliminar');
    assert.equal(dialogo.cancelar.textContent, 'Cancelar');
    dialogo.aceptar.clic();
    assert.equal(await promesa, true);
    assert.equal(dialogo.open, false);
  } finally {
    soltar();
  }
});

test('confirmar() devuelve false al cancelar', async () => {
  const dialogo = crearDialogo();
  const soltar = usarDocumento(dialogo);
  try {
    const promesa = confirmar({ titulo: 'Restaurar', cuerpo: '¿Restaurar?' });
    dialogo.cancelar.clic();
    assert.equal(await promesa, false);
    assert.equal(dialogo.open, false);
  } finally {
    soltar();
  }
});

test('confirmar() devuelve false si el diálogo se cierra con Escape', async () => {
  const dialogo = crearDialogo();
  const soltar = usarDocumento(dialogo);
  try {
    const promesa = confirmar({ titulo: 'Restaurar', cuerpo: '¿Restaurar?' });
    dialogo.close(); // Escape: cierra el <dialog> sin tocar los botones.
    assert.equal(await promesa, false);
  } finally {
    soltar();
  }
});

test('sin <dialog data-confirmar> la respuesta es false (nunca window.confirm)', async () => {
  const soltar = usarDocumento(null);
  try {
    assert.equal(await confirmar({ titulo: 'X', cuerpo: 'Y' }), false);
  } finally {
    soltar();
  }
});
