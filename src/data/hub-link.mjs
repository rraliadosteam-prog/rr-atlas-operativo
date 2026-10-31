/**
 * Destino del enlace "Volver al hub RR" del Atlas.
 *
 * El HUB (Mega Dashboard) documenta su servidor local en
 * ~/rr-encargos/2026-10-31_mega-dashboard/app/README.md:
 *   python3 -m http.server 8081  ->  http://localhost:8081/
 * Ese es el valor por defecto; el shell puede sobreescribirlo con el atributo
 * `data-hub-url` del elemento raíz sin tocar código.
 */
export const HUB_LABEL = 'Volver al hub RR';
export const HUB_URL = 'http://localhost:8081/';

export const hubUrlFrom = (source = {}) => {
  const candidate = typeof source?.hubUrl === 'string' ? source.hubUrl.trim() : '';
  return candidate || HUB_URL;
};
