#!/usr/bin/env node
// Pase de contenido de las 16 semillas BPMN.
//
// Que el lint quede en 0 avisos exige dos cosas del plugin de RR:
//   - rr/lane-es-rol   -> cada carril se llama como un rol, no como una etapa.
//   - rr/tarea-infinitivo -> cada tarea es un infinitivo corto (2 a 6 palabras).
//
// El script reescribe SOLO el atributo name de carriles y tareas. No toca
// documentación, flujos, formas ni colores. Es idempotente: si se corre dos
// veces no cambia nada (los nombres ya corregidos no están en las tablas).
//
// Uso: node scripts/pase-contenido-semillas.mjs [--simular]

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seedDir = resolve(root, 'src/bpmn/seeds');
const simular = process.argv.includes('--simular');

// --- Carriles: por semilla, el nombre del carril pasa a ser un rol de RR ---
const CARRILES = {
  alianzas_como_nace_una_alianza: {
    lane_1: 'Dirección',
    lane_2: 'Comercial',
    lane_3: 'Equipo RR · Lo que no está escrito',
  },
  clientes_que_pasa_despues_de_entregar: { lane_1: 'Comercial', lane_2: 'Soporte' },
  clientes_que_pasa_despues_de_que_firman: { lane_1: 'Comercial', lane_2: 'Dirección Operativa' },
  desarrollo_como_llega_un_producto_de_software_a_produccion: {
    lane_1: 'Desarrollo',
    lane_2: 'Cliente',
    lane_3: 'Soporte',
  },
  finanzas_como_entra_un_peso_a_la_cuenta: { lane_1: 'Finanzas', lane_2: 'Cliente' },
  finanzas_como_entra_y_se_sale_la_plata: {
    lane_1: 'Comercial',
    lane_2: 'Finanzas',
    lane_3: 'Dirección · La ventana de caja',
  },
  finanzas_como_se_le_paga_a_alguien: { lane_1: 'Dirección', lane_2: 'Finanzas' },
  finanzas_la_quincena: {
    lane_1: 'Finanzas · Ingresos',
    lane_2: 'Finanzas · Egresos',
    lane_3: 'Dirección · Caja',
    lane_4: 'Equipo RR · La fuente',
  },
  gobierno_como_se_gobierna_la_documentacion: { lane_1: 'Equipo RR', lane_2: 'Dirección' },
  ia_como_se_convierte_un_trabajo_repetitivo_en_un_agente: {
    lane_1: 'Bot',
    lane_2: 'Equipo RR',
  },
  ia_como_se_usa_la_ia_en_rr_aliados: {
    lane_1: 'Solicitante',
    lane_2: 'Bot',
    lane_3: 'Equipo RR · Las reglas que no se rompen',
  },
  informacion_de_donde_sale_la_respuesta: {
    lane_1: 'Solicitante',
    lane_2: 'Bot',
    lane_3: 'Equipo RR',
  },
  legal_como_se_firma_un_contrato: {
    lane_1: 'Legal',
    lane_2: 'Dirección',
    lane_3: 'Equipo RR · Donde se traba',
  },
  produccion_como_se_hace_una_pieza: {
    lane_1: 'Contenido',
    lane_2: 'Cliente',
    lane_3: 'Dirección',
  },
  soporte_como_se_resuelve_un_problema_de_un_cliente: {
    lane_1: 'Soporte',
    lane_2: 'Soporte · Prioridad',
    lane_3: 'Equipo RR · Resolución',
  },
  ventas_como_una_oportunidad_se_convierte_en_cliente: {
    lane_1: 'Comercial',
    lane_2: 'Dirección',
    lane_3: 'Equipo RR · A quién se le pregunta',
  },
};

// --- Tareas: nombre actual -> nombre en infinitivo ---
const TAREAS = {
  // Alianzas
  '2. Se valida el encaje': '2. Validar el encaje',
  'Se acuerda la comisión por escrito': 'Acordar la comisión por escrito',
  '4. Se registra el origen': '4. Registrar el origen',
  '6. Llega el prospecto': '6. Recibir el prospecto',
  '7. Seguimiento comercial': '7. Hacer el seguimiento comercial',
  '8. Se reporta al aliado': '8. Reportar al aliado',
  // Post entrega
  '6. Informe mensual': '6. Entregar el informe mensual',
  '7. Post mortem': '7. Hacer el post mortem',
  'Se escala': 'Escalar el caso',
  'Se define la garantía': 'Definir la garantía',
  '11. Se registra por qué se fue': '11. Registrar el motivo de salida',
  // Post firma
  'Se espera el pago': 'Esperar el pago',
  '3. Reunión de arranque': '3. Hacer la reunión de arranque',
  '4. Calendario de contenido': '4. Definir el calendario de contenido',
  '5. Primer entregable': '5. Entregar el primer entregable',
  // Desarrollo
  '1. Brief técnico': '1. Redactar el brief técnico',
  '2. Arquitectura': '2. Definir la arquitectura',
  '3. Prototipo': '3. Construir el prototipo',
  '4. Implementación': '4. Implementar la solución',
  '5. QA interno': '5. Revisar el QA interno',
  '7. Ajustes': '7. Aplicar los ajustes',
  '8. Deploy': '8. Hacer el deploy',
  '9. Documentación técnica': '9. Documentar la entrega',
  '10. Mantenimiento': '10. Hacer el mantenimiento',
  // Finanzas
  '1. Hay contrato firmado': '1. Verificar el contrato firmado',
  '2. Se emite la factura': '2. Emitir la factura',
  'Paga CLIENTE_A': 'Registrar el pago de CLIENTE_A',
  'Paga CLIENTE_B': 'Registrar el pago de CLIENTE_B',
  'Paga CLIENTE_C': 'Registrar el pago de CLIENTE_C',
  'Entra a la cuenta': 'Registrar el ingreso a la cuenta',
  '1. Cotiza o acuerdo': '1. Cotizar o cerrar el acuerdo',
  '2. Se pone por escrito': '2. Poner el acuerdo por escrito',
  '3. Se emite la cuenta': '3. Emitir la cuenta de cobro',
  '4. Entra la plata': '4. Registrar el ingreso',
  'Se revisa que cuadre': 'Revisar que cuadre',
  '7. Se sube al espejo': '7. Subir los datos al espejo',
  '8. Se persigue lo que falta': '8. Persistir lo que falta',
  '9. Se informa': '9. Informar el resultado',
  '1. Hay un trabajo que hacer': '1. Detectar el trabajo pendiente',
  '2. Se acuerda el valor': '2. Acordar el valor',
  '3. Se entrega el trabajo': '3. Entregar el trabajo',
  '4. Se emite la Cuenta de Cobro': '4. Emitir la cuenta de cobro',
  'Se persigue la firma': 'Persistir la firma',
  'Se paga': 'Pagar el valor acordado',
  'Entra CLIENTE_A': 'Registrar el ingreso de CLIENTE_A',
  'Entra CLIENTE_B': 'Registrar el ingreso de CLIENTE_B',
  'Entra CLIENTE_C': 'Registrar el ingreso de CLIENTE_C',
  'Sale el burn operativo': 'Registrar la salida del burn operativo',
  'Se pagan los fijos': 'Pagar los gastos fijos',
  'Se repite en 15 días': 'Repetir el ciclo cada 15 días',
  // Gobierno documental
  'Se decide el área canónica': 'Decidir el área canónica',
  '3. Se crea o actualiza el _CONTEXTO': '3. Crear o actualizar el _CONTEXTO',
  '4. Se evitan duplicados': '4. Evitar duplicados',
  '5. Se registra el historial': '5. Registrar el historial',
  '6. Se actualizan los índices': '6. Actualizar los índices',
  '7. Se archivan los espejos': '7. Archivar los espejos',
  'Se promueve a canónico': 'Promover a canónico',
  'Vuelve a la bandeja': 'Devolver a la bandeja',
  // IA
  'Se salta la revisión': 'Omitir la revisión',
  'Se reusa la que ya está': 'Reusar la que ya está',
  '3. Se decide el proveedor': '3. Decidir el proveedor',
  'Se descarta': 'Descartar la opción',
  '4. Se construye la skill': '4. Construir la skill',
  '5. Se prueba con error real': '5. Probar con un error real',
  '6. Se instala donde corresponde': '6. Instalar donde corresponda',
  '7. Se documenta': '7. Documentar el uso',
  // De dónde sale la respuesta
  '1. rr-consulta decide dónde mirar': '1. Consultar dónde está la fuente',
  'Si la fuente no está': 'Consultar si falta la fuente',
  '3. La nota fuente': '3. Redactar la nota fuente',
  '4. Se responde con fuente': '4. Responder con la fuente',
  '5. Se declara el límite': '5. Declarar el límite',
  'Notion no se usa': 'Excluir Notion del flujo',
  '7. La persona lee': '7. Revisar la respuesta',
  'Se anota el hueco': 'Anotar el hueco',
  // Legal
  '1. Se pide el contrato': '1. Solicitar el contrato',
  '2. Se usa la plantilla': '2. Usar la plantilla',
  '3. Revisión interna': '3. Hacer la revisión interna',
  'Revisión de acliente_cda externa': 'Hacer la revisión legal externa',
  '5. Aprobación de Dirección': '5. Aprobar en Dirección',
  'Se firma y se devuelve': 'Firmar y devolver el contrato',
  '7. Archivo en Drive': '7. Archivar el contrato en Drive',
  '8. Control de renovación': '8. Controlar la renovación',
  // Producción
  '2. Se buscan ideas': '2. Buscar ideas',
  '3. Se escribe': '3. Escribir el guion',
  '1. Brief: qué es y para qué': '1. Redactar el brief inicial',
  '5. Se prepara': '5. Preparar la sesión',
  '6. Se consigue': '6. Conseguir los recursos',
  '7. Se graba': '7. Grabar la sesión',
  '8. Se edita': '8. Editar la pieza',
  '9. Se revisa': '9. Revisar la pieza',
  '10. Se entrega': '10. Entregar la pieza',
  '11. Se mira qué pasó': '11. Medir los resultados',
  '12. ¿Y después qué?': '12. Definir el siguiente paso',
  // Soporte
  'Alta · se resuelve ya': 'Resolver de inmediato (prioridad alta)',
  'Media · pronto': 'Atender pronto (prioridad media)',
  'Baja · cuando se pueda': 'Atender cuando se pueda (prioridad baja)',
  '5. Se responde': '5. Responder al cliente',
  '6. Se arregla': '6. Resolver la falla',
  '8. Se cierra': '8. Cerrar el caso',
  '9. Se aprende': '9. Aprender del caso',
  // Ventas
  '3. Se mira qué es': '3. Revisar la necesidad',
  '4. Se propone': '4. Proponer la solución',
  '5. Precontrato': '5. Preparar el precontrato',
  '6. Se negocia': '6. Negociar el contrato',
  '7. Se firma o se aprueba': '7. Firmar o aprobar el acuerdo',
  '8. Onboarding': '8. Hacer el onboarding',
  '9. Arranca el trabajo': '9. Arrancar el trabajo',
};

// "Se anota" significa cosas distintas según el proceso.
const TAREAS_POR_ARCHIVO = {
  finanzas_como_entra_y_se_sale_la_plata: { '6. Se anota': '6. Registrar el movimiento' },
  ventas_como_una_oportunidad_se_convierte_en_cliente: { '2. Se anota': '2. Registrar el prospecto' },
  soporte_como_se_resuelve_un_problema_de_un_cliente: { '2. Se anota': '2. Registrar el caso' },
};

const STAGE_RE = /^(?:\d+\s*[·.\-–])|\betapa\b|\bfase\b|\bpaso\s+\d|\bpersona\b|\bsr\.?\b|\bsra\.?\b/i;
const INFINITIVE_RE = /(ar|er|ir)$/i;

function palabras(nombre) {
  return String(nombre || '')
    .replace(/^\d+\.\s*/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function tareaEnInfinitivo(nombre) {
  const palabrasTarea = palabras(nombre);
  const verbo = palabrasTarea[0] || '';
  return palabrasTarea.length >= 2 && palabrasTarea.length <= 6 && INFINITIVE_RE.test(verbo);
}

function escapar(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const archivos = (await readdir(seedDir)).filter((name) => name.endsWith('.bpmn')).sort();
let cambios = 0;
const sinMapa = [];

for (const archivo of archivos) {
  const semilla = archivo.replace(/\.bpmn$/, '');
  const ruta = resolve(seedDir, archivo);
  const original = await readFile(ruta, 'utf8');
  const carriles = CARRILES[semilla] || {};
  const tareas = { ...TAREAS, ...(TAREAS_POR_ARCHIVO[semilla] || {}) };

  let texto = original;

  // Carriles: el nombre se reemplaza por el rol.
  texto = texto.replace(/<bpmn:lane id="([^"]+)" name="([^"]*)"/g, (todo, id, nombre) => {
    const nuevo = carriles[id];
    if (!nuevo) {
      if (STAGE_RE.test(nombre)) sinMapa.push(`${semilla}: carril ${id} «${nombre}»`);
      return todo;
    }
    if (nuevo === nombre) return todo;
    cambios += 1;
    return `<bpmn:lane id="${id}" name="${escapar(nuevo)}"`;
  });

  // Tareas: el nombre pasa a infinitivo.
  texto = texto.replace(
    /<bpmn:(task|userTask|serviceTask|manualTask) id="([^"]+)" name="([^"]*)"/g,
    (todo, tipo, id, nombre) => {
      const nuevo = tareas[nombre];
      if (!nuevo) {
        if (!tareaEnInfinitivo(nombre)) sinMapa.push(`${semilla}: tarea ${id} «${nombre}»`);
        return todo;
      }
      if (nuevo === nombre) return todo;
      cambios += 1;
      return `<bpmn:${tipo} id="${id}" name="${escapar(nuevo)}"`;
    },
  );

  if (texto !== original) {
    if (simular) {
      console.log(`[simular] ${archivo}: ${texto.length - original.length} bytes de diferencia`);
    } else {
      await writeFile(ruta, texto, 'utf8');
      console.log(`escrito ${archivo}`);
    }
  }
}

if (sinMapa.length) {
  console.log('\nSin tabla (revisar a mano):');
  for (const item of sinMapa) console.log(`  - ${item}`);
}

console.log(`\n${cambios} nombres corregidos${simular ? ' (simulación, no se escribió nada)' : ''}.`);
