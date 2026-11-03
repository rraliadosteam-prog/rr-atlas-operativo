/**
 * Base versionada del Atlas RR (esquema v5).
 *
 * Estos archivos solo cambian por PR. Los cambios del usuario viven en
 * `localStorage` (`rr-atlas:v5`) como diff sobre esta base.
 */

import empresa from './empresa.json' with { type: 'json' };
import equipo from './equipo.json' with { type: 'json' };
import clientes from './clientes.json' with { type: 'json' };
import proyectos from './proyectos.json' with { type: 'json' };
import procesos from './procesos.json' with { type: 'json' };

export const EMPRESA = empresa.empresa;

export const BASE = {
  area: empresa.area,
  rol: equipo.rol,
  persona: equipo.persona,
  lineaNegocio: empresa.lineaNegocio,
  cliente: clientes.cliente,
  proyecto: proyectos.proyecto,
  sistema: proyectos.sistema,
  proceso: procesos.proceso,
  paso: [],
  fragmento: [],
  tarea: [],
};

export default BASE;
