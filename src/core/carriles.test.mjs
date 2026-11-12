import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MAPA_CARRIL_ROL, carrilesDelProceso, normalizarCarril, rolDelCarril } from './carriles.mjs';
import { BASE } from '../data/base/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('el diccionario de carriles solo apunta a roles que existen en la base', () => {
  const ids = new Set(BASE.rol.map((rol) => rol.id));
  for (const [carril, rolId] of Object.entries(MAPA_CARRIL_ROL)) {
    assert.ok(ids.has(rolId), `el carril «${carril}» apunta a un rol que no existe: ${rolId}`);
  }
});

test('normalizar un carril quita tildes y mayúsculas', () => {
  assert.equal(normalizarCarril('Dirección · Caja'), 'direccion · caja');
  assert.equal(rolDelCarril('Finanzas · Ingresos'), 'rol-bot-fin');
  assert.equal(rolDelCarril('Carril que no existe'), '');
});

test('carrilesDelProceso separa roles, nombres y pendientes', () => {
  const resultado = carrilesDelProceso(['Dirección', 'Equipo RR', 'Dirección']);
  assert.deepEqual(resultado.nombres, ['Dirección', 'Equipo RR']);
  assert.deepEqual(resultado.roles, ['rol-ceo']);
  assert.deepEqual(resultado.pendientes, ['Equipo RR']);
});

test('los 16 procesos con semilla traen los carriles que se leen en el diagrama', async () => {
  const indice = JSON.parse(await readFile(resolve(root, 'src/bpmn/seeds/index.json'), 'utf8'));
  assert.equal(indice.procesos.length, 16);
  for (const proceso of indice.procesos) {
    const registro = BASE.proceso.find((item) => item.semilla === proceso.archivo);
    assert.ok(registro, `falta el proceso de la semilla ${proceso.archivo}`);
    assert.ok(Array.isArray(registro.carrilNombres), `${proceso.archivo} sin carrilNombres`);
    assert.ok(registro.carrilNombres.length > 0, `${proceso.archivo} sin carriles`);
    assert.ok(Array.isArray(registro.carriles), `${proceso.archivo} sin carriles`);
    assert.ok(Array.isArray(registro.carrilPendientes), `${proceso.archivo} sin carrilPendientes`);
    const ids = new Set(BASE.rol.map((rol) => rol.id));
    for (const rolId of registro.carriles) {
      assert.ok(ids.has(rolId), `${proceso.archivo} apunta a un rol inexistente: ${rolId}`);
    }
    // Cada carril del diagrama queda con un rol (puede ser el mismo rol para
    // dos carriles, por eso se comparan nombres y no conteos) o pendiente.
    for (const nombre of registro.carrilNombres) {
      const mapeado = Boolean(rolDelCarril(nombre));
      const pendiente = registro.carrilPendientes.includes(nombre);
      assert.ok(mapeado !== pendiente, `${proceso.archivo}: el carril «${nombre}» está en los dos lados o en ninguno`);
    }
  }
});
