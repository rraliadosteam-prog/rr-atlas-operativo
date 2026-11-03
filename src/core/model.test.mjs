import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COLECCIONES,
  SCHEMA_VERSION,
  crearModelo,
  diff,
  exportar,
  fusionar,
  importar,
  migrarDesdeEstadoA,
  migrarDesdeV4,
  validar,
  validarRegistro,
} from './model.mjs';

const persona = (extra = {}) => ({
  id: 'persona-1',
  nombre: 'Persona de prueba',
  descripcion: '',
  fuente: '20_Empresa/equipo.md',
  corte: '2026-09-26',
  estado: 'activo',
  etiquetas: [],
  actualizadoEn: '',
  rolIds: ['rol-1'],
  ...extra,
});

test('el modelo v5 arranca con schemaVersion 5 y todas las colecciones', () => {
  const modelo = crearModelo();
  assert.equal(modelo.schemaVersion, SCHEMA_VERSION);
  for (const coleccion of COLECCIONES) {
    assert.ok(Array.isArray(modelo.base[coleccion]), `falta base.${coleccion}`);
    assert.equal(typeof modelo.cambios[coleccion], 'object', `falta cambios.${coleccion}`);
  }
});

test('la migración desde el export v4 del mapa vivo deja entidades del esquema v5', () => {
  const v4 = {
    schemaVersion: 1,
    exportedAt: '2026-11-02T00:00:00.000Z',
    nodes: [
      { id: 'RO-1', title: 'Prospección outbound', type: 'process', statusKey: 'deuda', owner: 'Dirección', kpi: 'Leads', lineId: 'ropa' },
      { id: 'bot-fin', title: 'Bot Fin', type: 'bot' },
      { id: 'linea-ropa', title: 'SaaS ropa', type: 'line' },
      { id: 'cliente-x', title: 'Cliente', type: 'client' },
    ],
    edges: [],
  };
  const modelo = migrarDesdeV4(v4, { corte: '2026-09-26' });
  assert.equal(modelo.schemaVersion, SCHEMA_VERSION);
  const entidades = fusionar(modelo).entidades;
  assert.equal(entidades.proceso.length, 1);
  assert.equal(entidades.proceso[0].estadoBpmn, 'con deuda');
  assert.equal(entidades.rol[0].tipo, 'bot');
  assert.equal(entidades.lineaNegocio.length, 1);
  assert.equal(entidades.cliente.length, 1);
  assert.equal(entidades.proceso[0].corte, '2026-09-26');
  assert.equal(validar(modelo).ok, true);
});

test('la migración desde el estado de la rama A deja procesos en borrador', () => {
  const modelo = migrarDesdeEstadoA({ nodes: [{ id: 'n1', label: 'Proceso' }], edges: [] }, { corte: '2026-09-26' });
  const entidades = fusionar(modelo).entidades;
  assert.equal(entidades.proceso.length, 1);
  assert.equal(entidades.proceso[0].estadoBpmn, 'borrador');
  assert.equal(validar(modelo).ok, true);
});

test('exportar e importar es idempotente', () => {
  const modelo = crearModelo({ persona: [persona()] });
  const paquete = exportar(modelo, { exportadoEn: '2026-11-02T00:00:00.000Z' });
  const importado = importar(paquete);
  const reexportado = exportar(importado);
  assert.deepEqual(reexportado, paquete);
  assert.deepEqual(fusionar(importado).entidades, fusionar(modelo).entidades);
});

test('el validador rechaza los campos prohibidos', () => {
  for (const campo of ['salario', 'cedula', 'cuenta', 'token', 'password']) {
    const modelo = crearModelo({ persona: [persona({ [campo]: 'x' })] });
    const reporte = validar(modelo);
    assert.equal(reporte.ok, false, `debió rechazar ${campo}`);
    assert.ok(reporte.errores.some((error) => error.codigo === 'CAMPO_PROHIBIDO'));
  }
});

test('el validador acepta «cuenta de cobro» porque es un flujo, no una cuenta bancaria', () => {
  const modelo = crearModelo({
    proceso: [{
      id: 'proceso-1',
      nombre: 'Facturación',
      descripcion: '',
      fuente: '20_Empresa/proyectos.md',
      corte: '2026-10-14',
      estado: 'activo',
      etiquetas: [],
      actualizadoEn: '',
      cuentaCobro: 'Cuenta de Cobro a cliente',
    }],
  });
  assert.equal(validar(modelo).ok, true);
});

test('el validador pide id, nombre, fuente y corte en toda entidad', () => {
  const errores = validarRegistro('persona', { id: 'p1' }, 'persona.p1');
  const campos = errores.map((error) => error.ruta.split('.').pop());
  assert.ok(campos.includes('nombre'));
  assert.ok(campos.includes('fuente'));
  assert.ok(campos.includes('corte'));
});

test('el diff marca nuevo, cambiado y quitado', () => {
  const modelo = crearModelo({ persona: [persona()] });
  modelo.cambios.persona['persona-1'] = { ...persona({ estado: 'histórico' }) };
  modelo.cambios.persona['persona-2'] = persona({ id: 'persona-2', nombre: 'Otra' });
  modelo.cambios.persona['persona-3'] = null;
  const resumen = diff(modelo);
  assert.ok(resumen.some((item) => item.id === 'persona-1' && item.tipo === 'cambiado'));
  assert.ok(resumen.some((item) => item.id === 'persona-2' && item.tipo === 'nuevo'));
  assert.ok(resumen.some((item) => item.id === 'persona-3' && item.tipo === 'quitado'));
});

test('importar un paquete con campo prohibido no toca nada', () => {
  const paquete = exportar(crearModelo({ persona: [persona()] }), { exportadoEn: '2026-11-02T00:00:00.000Z' });
  paquete.base.persona[0].salario = '3.000.000';
  assert.throws(() => importar(paquete), (error) => error.code === 'VALIDACION');
});
