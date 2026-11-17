/**
 * Destino del enlace al hub RR Aliados (Mega Dashboard / Centro de Mando).
 *
 * El hub es la puerta de entrada única: el catálogo de desarrollos, los accesos
 * centralizados y el tablero de avances viven en
 *   https://rr-aliados-mega-dashboard.vercel.app/
 * Ese es el valor por defecto del Atlas: un enlace que funciona en producción
 * (antes apuntaba a `http://localhost:8081/`, que solo existe en el portátil
 * de desarrollo y en el deploy queda como un enlace roto).
 *
 * Para desarrollo local el shell puede sobreescribirlo con el atributo
 * `data-hub-url` del elemento raíz, sin tocar código:
 *   <html data-hub-url="http://localhost:8081/">
 */
export const HUB_LABEL = 'Volver al hub RR';
export const HUB_URL = 'https://rr-aliados-mega-dashboard.vercel.app/';
/** Servidor local del hub, solo para desarrollo (se activa con `data-hub-url`). */
export const HUB_URL_LOCAL = 'http://localhost:8081/';

export const hubUrlFrom = (source = {}) => {
  const candidate = typeof source?.hubUrl === 'string' ? source.hubUrl.trim() : '';
  return candidate || HUB_URL;
};
