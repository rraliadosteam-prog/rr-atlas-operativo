// Tema del motor BPMN de RR.
// Los colores salen de las variables CSS de B (src/rr-estilo/tokens.css):
// --rr-fucsia, --rr-mostaza, --rr-orquidea, --rr-negro y --rr-crema.
// No se inventan colores propios: si una variable falta, se usa la marca de la marca.
export function readRrTheme(element = document.body) {
  const style = getComputedStyle(element || document.body);
  const read = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
  return {
    stroke: read('--rr-negro', '#070001'),
    fill: read('--rr-crema', '#fffff3'),
    attention: read('--rr-mostaza', '#ded116'),
    alarm: read('--rr-fucsia', '#be076d'),
    lane: read('--rr-orquidea', '#973d8f'),
    muted: read('--rr-gris', '#7a7680'),
    text: read('--rr-negro', '#070001'),
    end: read('--rr-negro', '#070001'),
    ink: read('--rr-negro', '#070001'),
    paper: read('--rr-crema', '#fffff3'),
  };
}
