/**
 * Mapeo de los carriles de los diagramas BPMN a los roles del modelo v5.
 *
 * Los diagramas usan nombres de carril que se leen bien en pantalla
 * («Dirección», «Finanzas · Ingresos»). El modelo v5 guarda los roles con su
 * id (`rol-ceo`, `rol-bot-fin`…), así que hace falta un diccionario.
 *
 * Regla de este diccionario: **solo se mapea lo que una fuente de RR
 * respalda**. Lo demás queda sin rol («sin confirmar») y anotado en
 * `docs/fusion/PREGUNTAS.md`, porque no hay fuente que diga qué cargo real
 * está en cada carril.
 *
 *   - «Finanzas» → Bot Fin: el Manual de los bots de RR (corte 2026-10-24)
 *     lo describe como el CFO automático.
 *   - «Legal» → Abogado externo: rol externo del manual de roles.
 *   - «Desarrollo» → Project Manager / Programador: rol del manual de roles
 *     (su estado sigue «sin confirmar»).
 *   - «Dirección» → CEO: el mega prompt §6.12 pone la aprobación de
 *     contratos en Dirección y §6.1 en el CEO.
 *   - «Dirección Operativa» → Director Operativo: mismo nombre del manual.
 *   - «Comercial» → Bot Captación: el mega prompt §6.2.1 pone el carril de
 *     «Oportunidad a cliente» como «Comercial/Captación» y el Manual de los
 *     bots (corte 2026-10-24) describe a Captación como el de estrategia y
 *     reparto de leads. No hay en el manual de roles un cargo humano de
 *     ventas, así que el único rol con fuente es el bot.
 *   - «Contenido» → Director Creativo: el mega prompt §6.3.4 lista el carril
 *     de «Producción de una pieza de contenido» como «Dir. Creativo,
 *     Consultora, Editor, Camarógrafo (por definir), cliente» y el manual de
 *     roles (corte 2026-09-26) pone contenido crudo y liderazgo de grabación
 *     en el Director Creativo.
 *
 * Lo que sigue sin fuente y queda pendiente: «Soporte», «Cliente»,
 * «Solicitante», «Bot», «Equipo RR» y sus coletillas (no hay cargo humano de
 * soporte, ni rol externo para el cliente, ni un «solicitante» en el manual).
 */

export const MAPA_CARRIL_ROL = Object.freeze({
  'direccion': 'rol-ceo',
  'direccion · caja': 'rol-ceo',
  'direccion · la ventana de caja': 'rol-ceo',
  'direccion operativa': 'rol-director-operativo',
  'finanzas': 'rol-bot-fin',
  'finanzas · ingresos': 'rol-bot-fin',
  'finanzas · egresos': 'rol-bot-fin',
  'legal': 'rol-externo-abogado',
  'desarrollo': 'rol-project-manager',
  'comercial': 'rol-bot-captacion',
  'contenido': 'rol-director-creativo',
});

/** Normaliza un nombre de carril para poder compararlo. */
export function normalizarCarril(nombre) {
  return String(nombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Id del rol del modelo para un carril ('' si no hay fuente que lo respalde). */
export function rolDelCarril(nombre) {
  return MAPA_CARRIL_ROL[normalizarCarril(nombre)] ?? '';
}

/**
 * Convierte los carriles de un diagrama en datos del modelo.
 * Devuelve los nombres tal como están en el diagrama, los roles con fuente y
 * los carriles que quedan pendientes de confirmar con Rosas.
 */
export function carrilesDelProceso(nombres = []) {
  const lista = [...new Set(nombres.map((nombre) => String(nombre ?? '').trim()).filter(Boolean))];
  const roles = [];
  const pendientes = [];
  for (const nombre of lista) {
    const rol = rolDelCarril(nombre);
    if (rol) {
      if (!roles.includes(rol)) roles.push(rol);
    } else {
      pendientes.push(nombre);
    }
  }
  return { nombres: lista, roles, pendientes };
}
