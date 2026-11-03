// La banda de lectura del paso (bloque 2 · ítems 4 y 5 · P1.4).
//
//   node --test src/app/bpmn-banda.test.mjs
//
// Dos cosas se comprueban aquí:
//
// 1. **El contenido de la banda, en datos puros** (`contenidoBanda`, sin
//    DOM): la posición («Paso 3 de 15»), el carril que falta («sin carril»),
//    la nota que falta (se oculta) y el nombre que falta (**no se inventa
//    texto**). Y que con el modo paso apagado la banda no se muestra.
// 2. **El markup y los estilos**, que las puertas de navegador necesitan
//    como selector estable: el bloque `<aside class="bpmn-banda"
//    data-bpmn-banda>` con sus cuatro hijos, entre la cabecera y la barra;
//    la lectura del zoom en la barra (`data-bpmn-zoom`); y el tope de un
//    tercio de la altura con scroll interno.
//
// Lo que esta prueba **no** puede hacer (necesita un navegador) se dice al
// final: que la banda se pinte de verdad al abrir un diagrama, que el «−»
// reduzca el zoom y que el gancho de depuración se borre al salir de la
// vista. Eso lo miden `scripts/verificar-movil.mjs`,
// `scripts/verificar-tactil.mjs` y `scripts/verificar-pulido.mjs`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contenidoBanda } from './bpmn-view.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const HTML = readFileSync(resolve(RAIZ, 'index.html'), 'utf8');
const CSS = readFileSync(resolve(RAIZ, 'src', 'styles', 'bpmn.css'), 'utf8');
const VISTA = readFileSync(resolve(RAIZ, 'src', 'app', 'bpmn-view.mjs'), 'utf8');

// ── El contenido de la banda ─────────────────────────────────────────────

test('La posición de la banda es «Paso 3 de 15»', () => {
  const banda = contenidoBanda({ indice: 2, total: 15, nombre: 'Revisar', carril: 'Equipo RR', nota: 'Una nota' });
  assert.equal(banda.visible, true);
  assert.equal(banda.posicion, 'Paso 3 de 15');
  assert.equal(banda.nombre, 'Revisar');
  assert.equal(banda.carril, 'Equipo RR');
  assert.equal(banda.sinCarril, false);
  assert.equal(banda.nota, 'Una nota');
  assert.equal(banda.conNota, true);
});

test('El primer paso es «Paso 1 de N» (no «Paso 0»)', () => {
  const banda = contenidoBanda({ indice: 0, total: 3 });
  assert.equal(banda.posicion, 'Paso 1 de 3');
});

test('Si el carril falta, la banda dice «sin carril» y no inventa uno', () => {
  const banda = contenidoBanda({ indice: 0, total: 2, nombre: 'Un paso', carril: '', nota: '' });
  assert.equal(banda.carril, 'sin carril');
  assert.equal(banda.sinCarril, true);
});

test('Si la nota falta, la nota queda vacía y la banda la oculta', () => {
  const banda = contenidoBanda({ indice: 0, total: 2, nombre: 'Un paso', carril: 'Equipo RR', nota: '' });
  assert.equal(banda.nota, '');
  assert.equal(banda.conNota, false, 'Sin nota, la banda la oculta');
});

test('Si el nombre falta, el nombre queda vacío (no se inventa texto)', () => {
  const banda = contenidoBanda({ indice: 0, total: 2, nombre: '', carril: 'Equipo RR' });
  assert.equal(banda.nombre, '');
});

test('Con el modo paso apagado, la banda no se muestra', () => {
  const paso = { indice: 0, total: 5, nombre: 'Un paso', carril: 'Equipo RR', nota: 'Nota' };
  const banda = contenidoBanda(paso, { modoPaso: false });
  assert.equal(banda.visible, false);
  assert.equal(banda.posicion, '', 'No se escribe nada cuando la banda está apagada');
  assert.equal(banda.nombre, '');
  assert.equal(banda.carril, '');
  assert.equal(banda.nota, '');
});

test('Sin diagrama abierto (o sin pasos), la banda no se muestra', () => {
  assert.equal(contenidoBanda(null).visible, false);
  assert.equal(contenidoBanda(undefined).visible, false);
  assert.equal(contenidoBanda({ indice: 0, total: 0 }).visible, false, 'Un diagrama sin pasos no inventa un paso');
});

// ── El markup ─────────────────────────────────────────────────────────────

test('El bloque de la banda existe con sus cuatro hijos', () => {
  assert.match(HTML, /<aside class="bpmn-banda" data-bpmn-banda/);
  for (const atributo of ['posicion', 'nombre', 'carril', 'nota']) {
    assert.ok(
      HTML.includes(`data-bpmn-banda-${atributo}`),
      `Falta el atributo data-bpmn-banda-${atributo}`,
    );
  }
});

test('La banda vive entre la cabecera y la barra, y fuera del lienzo', () => {
  const cabeza = HTML.indexOf('class="bpmn-view__head"');
  const banda = HTML.indexOf('data-bpmn-banda');
  const barra = HTML.indexOf('class="bpmn-toolbar"');
  const lienzo = HTML.indexOf('class="bpmn-canvas-wrap"');
  assert.ok(cabeza >= 0 && banda > cabeza, 'La banda va después de la cabecera');
  assert.ok(banda < barra, 'La banda va antes de la barra');
  assert.ok(lienzo > barra, 'La barra (y la banda) van antes del lienzo');
  // Y la banda no está dentro del lienzo: no puede tapar el diagrama.
  const bloqueBanda = HTML.slice(HTML.indexOf('<aside class="bpmn-banda"'), HTML.indexOf('</aside>'));
  assert.doesNotMatch(bloqueBanda, /bpmn-canvas/);
});

test('La barra muestra el zoom efectivo (data-bpmn-zoom)', () => {
  assert.match(HTML, /data-bpmn-zoom/);
  const barra = HTML.slice(HTML.indexOf('class="bpmn-toolbar"'), HTML.indexOf('class="bpmn-canvas-wrap"'));
  assert.ok(barra.includes('data-bpmn-zoom'), 'El zoom se lee en la barra');
});

// ── Los estilos ───────────────────────────────────────────────────────────

test('La banda se acota a un tercio de la altura y hace scroll interno', () => {
  const bloque = CSS.slice(CSS.indexOf('.bpmn-banda {'), CSS.indexOf('.bpmn-banda[hidden]'));
  assert.match(bloque, /max-height:\s*33vh/, 'La banda no puede pasar de un tercio de la altura');
  assert.match(bloque, /overflow:\s*auto/, 'La banda hace scroll interno');
});

test('El lienzo nunca queda por debajo de 44 px útiles', () => {
  assert.match(CSS, /\.bpmn-view\.is-completo \.bpmn-canvas-wrap \{ min-height: 44px; \}/);
});

test('La banda se oculta cuando el elemento está oculto', () => {
  assert.match(CSS, /\.bpmn-banda\[hidden\] \{ display: none; \}/);
  assert.match(CSS, /\.bpmn-banda__nota\[hidden\] \{ display: none; \}/);
});

// ── El gancho de depuración (P1.9) ────────────────────────────────────────

test('El gancho es { workspace, estado() } y se borra al salir de la vista', () => {
  assert.match(VISTA, /window\.__rrAtlasBpmn = \{\s*workspace,/);
  assert.match(VISTA, /estado: \(\) => \(\{ \.\.\.\(workspace\.estado\?\.\(\) \|\| \{\}\), ruta: location\.hash \}\)/);
  // El gancho no sobrevive a la salida de la vista.
  const ocultar = VISTA.slice(VISTA.indexOf('function ocultar()'), VISTA.indexOf('function ocultar()') + 1200);
  assert.match(ocultar, /delete window\.__rrAtlasBpmn/);
});

test('El «−» llama a workspace.zoom(0.85) (el piso nuevo lo hace reducir)', () => {
  assert.match(VISTA, /tipo === 'alejar'\) \{ workspace\?\.zoom\(0\.85\)/);
});

test('La banda se rellena con la API pública de paso', () => {
  assert.match(VISTA, /workspace\?\.pasoActual\?\.\(\)/);
  assert.match(VISTA, /workspace\.irAPaso\?\.\(destino\)/);
});

test('La banda lee las preferencias vigentes (con el override de sesión)', () => {
  assert.match(VISTA, /obtenerPreferenciasVigentes\(\)/);
  assert.match(VISTA, /from '\.\.\/core\/prefs\.mjs'/);
});
