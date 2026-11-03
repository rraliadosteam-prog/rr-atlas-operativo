/**
 * Base versionada del Atlas RR (esquema v5).
 *
 * Estos archivos solo cambian por PR. Los cambios del usuario viven en
 * `localStorage` (`rr-atlas:v5`) como diff sobre esta base.
 *
 * En Node (pruebas) los archivos se importan como módulos JSON; en el
 * navegador la vista Datos los baja por `fetch` (ver `componer.mjs`), para
 * que la app no dependa del soporte de módulos JSON del navegador.
 */

import empresa from './empresa.json' with { type: 'json' };
import equipo from './equipo.json' with { type: 'json' };
import clientes from './clientes.json' with { type: 'json' };
import proyectos from './proyectos.json' with { type: 'json' };
import procesos from './procesos.json' with { type: 'json' };
import { componerBase } from './componer.mjs';

export const EMPRESA = empresa.empresa;

export const BASE = componerBase({ empresa, equipo, clientes, proyectos, procesos });

export default BASE;
