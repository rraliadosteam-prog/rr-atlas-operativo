import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BASE, EMPRESA } from './index.mjs';
import { COLECCIONES, crearModelo, fusionar, validar } from '../../core/model.mjs';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('la base v5 pasa el validador completo', () => {
  const reporte = validar(crearModelo(BASE));
  assert.deepEqual(reporte.errores, []);
  assert.equal(reporte.ok, true);
});

test('la base trae las colecciones del esquema v5', () => {
  for (const coleccion of COLECCIONES) {
    assert.ok(Array.isArray(BASE[coleccion]), `falta ${coleccion}`);
  }
  assert.ok(BASE.proceso.length >= 40, 'el catálogo de procesos está incompleto');
  assert.ok(BASE.cliente.length === 11, 'faltan clientes');
  assert.ok(BASE.rol.length >= 20, 'faltan roles');
});

test('toda entidad de la base lleva fuente y corte', () => {
  const entidades = fusionar(crearModelo(BASE)).entidades;
  for (const coleccion of COLECCIONES) {
    for (const registro of entidades[coleccion]) {
      assert.equal(typeof registro.fuente, 'string', `${coleccion}.${registro.id} sin fuente`);
      assert.equal(typeof registro.corte, 'string', `${coleccion}.${registro.id} sin corte`);
      assert.ok(registro.fuente.length > 0 && registro.corte.length > 0, `${coleccion}.${registro.id} con fuente o corte vacío`);
    }
  }
});

test('la base no trae cifras financieras', () => {
  const entidades = fusionar(crearModelo(BASE)).entidades;
  const texto = JSON.stringify(entidades);
  assert.equal(/\$\s?\d/.test(texto), false, 'hay un monto con signo de pesos');
  assert.equal(/\bCOP\b/.test(texto), false, 'hay una cifra en COP');
  assert.equal(/\d{1,3}(?:[.,]\d{3})+(?!\d)/.test(texto), false, 'hay un monto con separador de miles');
  assert.equal(/\b\d+\s*mes(es)?\s+de\s+runway\b/i.test(texto), false, 'hay una cifra de runway');
  assert.equal(/\bsaldo\b/i.test(texto), false, 'hay un saldo');
});

test('los 16 procesos con semilla BPMN están en estado válido', async () => {
  const index = JSON.parse(await readFile(resolve(root, 'src/bpmn/seeds/index.json'), 'utf8'));
  const entidades = fusionar(crearModelo(BASE)).entidades;
  for (const proceso of index.procesos) {
    const registro = entidades.proceso.find((item) => item.semilla === proceso.archivo);
    assert.ok(registro, `falta el proceso de la semilla ${proceso.archivo}`);
    assert.equal(registro.estadoBpmn, 'válido', `${proceso.archivo} no está en estado válido`);
  }
});

test('la empresa tiene identidad, capacidades y principios', () => {
  assert.equal(EMPRESA.razonSocial, 'RR ALIADOS S.A.S.');
  assert.ok(EMPRESA.capacidades.includes('Marca'));
  assert.ok(EMPRESA.principios.length >= 5);
  assert.equal(EMPRESA.fuente, '20_Empresa/identidad.md');
});
