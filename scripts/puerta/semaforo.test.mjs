import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificarTsc, colorDatos, colorDrive, colorEstructura, colorFlujo, peor } from './semaforo.mjs';

test('peor devuelve el color más grave', () => {
  assert.equal(peor('verde', 'amarillo'), 'amarillo');
  assert.equal(peor('amarillo', 'rojo', 'verde'), 'rojo');
  assert.equal(peor(), 'verde');
});

test('clasificarTsc separa graves de avisos', () => {
  const salida = [
    "src/a.mjs(1,2): error TS2304: Cannot find name 'X'.",
    "src/b.mjs(3,4): error TS2339: Property 'hidden' does not exist on type 'Element'.",
    "src/c.mjs(5,6): error TS2307: Cannot find module './falta.mjs' or its corresponding type declarations.",
    "src/d.mjs(7,8): error TS2307: Cannot find module './x.mjs?v=1' or its corresponding type declarations.",
    "src/e.mjs(9,9): error TS2307: Cannot find module 'bpmn-js/lib/Modeler' or its corresponding type declarations.",
  ].join('\n');
  const { graves, avisos } = clasificarTsc(salida);
  assert.deepEqual(graves.map((e) => e.archivo), ['src/a.mjs', 'src/c.mjs']);
  assert.equal(avisos.length, 3);
});

test('colorEstructura', () => {
  const ok = { ok: true };
  assert.equal(colorEstructura({ build: ok, pruebas: ok, sintaxis: ok, tsc: { corrio: true, graves: [] } }), 'verde');
  assert.equal(colorEstructura({ build: ok, pruebas: ok, sintaxis: ok, tsc: { corrio: false, graves: [] } }), 'amarillo');
  assert.equal(colorEstructura({ build: { ok: false }, pruebas: ok, sintaxis: ok, tsc: { corrio: true, graves: [] } }), 'rojo');
  assert.equal(colorEstructura({ build: ok, pruebas: ok, sintaxis: ok, tsc: { corrio: true, graves: [{}] } }), 'rojo');
});

test('colorFlujo', () => {
  const bien = Array.from({ length: 20 }, () => ({ estado: 'funciona' }));
  assert.equal(colorFlujo(bien), 'verde');
  assert.equal(colorFlujo([...bien, { estado: 'sin-respuesta' }]), 'amarillo');
  assert.equal(colorFlujo([...bien, { estado: 'falla' }]), 'amarillo');
  assert.equal(colorFlujo([...bien, { estado: 'falla', errorApp: 'boom' }]), 'rojo');
  assert.equal(colorFlujo([]), 'rojo');
});

test('colorDrive', () => {
  assert.equal(colorDrive({ implementada: false }), 'rojo');
  assert.equal(colorDrive({ implementada: true, medida: false }), 'amarillo');
  assert.equal(colorDrive({ implementada: true, medida: true, segundos: 30 }), 'verde');
  assert.equal(colorDrive({ implementada: true, medida: true, segundos: 600 }), 'amarillo');
});

test('colorDatos', () => {
  assert.equal(colorDatos({ escriturasRemotas: [], peticionesEscritura: [], guardadoLocal: [] }), 'verde');
  assert.equal(colorDatos({ escriturasRemotas: [], peticionesEscritura: [], guardadoLocal: ['x'] }), 'amarillo');
  assert.equal(colorDatos({ escriturasRemotas: ['x'], peticionesEscritura: [], guardadoLocal: [] }), 'rojo');
});
