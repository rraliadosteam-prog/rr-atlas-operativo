// Portada «Hoy» del Atlas (17-nov-2026, plan v2).
// Antes el Atlas abría directo en el mapa al 20 % de zoom: ilegible.
// Ahora abre en una portada con 3 franjas (clientes, desarrollos, flujos) y
// el mapa queda a un clic en «Ver mapa completo» (#mapa).
import { CORTE, ESTADOS_CLIENTE } from '../data/corte-manual.mjs';
import { flujosPublicos } from '../data/flujos-publicos.mjs';

const ICONO = { verde: '✓', mostaza: '●', rojo: '✕' };

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const titulo = (t) => {
  const s = String(t || '').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function html() {
  const clientes = ESTADOS_CLIENTE.map(([estado, nombre]) => {
    const lista = CORTE.clientes.filter((c) => c.estado === estado);
    return `<div class="ph-col"><h3>${nombre} <span class="ph-num">${lista.length}</span></h3>${
      lista.length ? `<ul>${lista.map((c) => `<li>${esc(c.nombre)}</li>`).join('')}</ul>` : '<p class="ph-vacio">Ninguno.</p>'
    }</div>`;
  }).join('');
  const rojos = CORTE.desarrollos.filter((d) => d.semaforo === 'rojo').length;
  const desarrollos = CORTE.desarrollos.map((d) => `<li class="ph-dev ph-dev--${d.semaforo}">
      <span class="ph-dev__nombre">${esc(d.nombre)}</span>
      <span class="ph-chip ph-chip--${d.semaforo}"><span aria-hidden="true">${ICONO[d.semaforo]} </span>${esc(d.estado)}</span>
      ${d.enlace ? `<a class="ph-link" href="${esc(d.enlace)}" target="_blank" rel="noopener">Revisar ↗</a>` : ''}
    </li>`).join('');
  const flujos = flujosPublicos.map((f) => `<li><a class="ph-flujo" href="#flujo/${encodeURIComponent(f.id)}">
      <span class="ph-flujo__area">${esc(f.area_nombre || 'Proceso')}</span>
      <span class="ph-flujo__titulo">${esc(titulo(f.titulo))}</span>
      <span aria-hidden="true" class="ph-flujo__flecha">→</span></a></li>`).join('');
  return `
    <div class="ph-cabecera">
      <div>
        <p class="ph-eyebrow">Atlas operativo · Hoy</p>
        <h1>Cómo va RR, de un vistazo</h1>
        <p class="ph-sub">Clientes por estado, desarrollos con su semáforo y los ${flujosPublicos.length} procesos documentados. El mapa completo está a un clic.</p>
      </div>
      <a class="ph-boton" href="#mapa">Ver mapa completo →</a>
    </div>
    <p class="ph-franja-corte" role="note"><span aria-hidden="true">◆ </span>Clientes y desarrollos: ${esc(CORTE.etiqueta)}.</p>
    <section class="ph-franja" aria-labelledby="ph-clientes"><h2 id="ph-clientes">Clientes <span class="ph-num">${CORTE.clientes.length}</span></h2><div class="ph-cols">${clientes}</div></section>
    <section class="ph-franja" aria-labelledby="ph-desarrollos"><h2 id="ph-desarrollos">Desarrollos <span class="ph-num">${CORTE.desarrollos.length}</span></h2>
      <p class="ph-nota">Regla RR: todo desarrollo tiene su código guardado en GitHub y sale en línea solo con una versión nueva aprobada. <strong>${rojos} no la cumplen.</strong></p>
      <ul class="ph-devs">${desarrollos}</ul></section>
    <section class="ph-franja" aria-labelledby="ph-flujos"><h2 id="ph-flujos">Procesos documentados <span class="ph-num">${flujosPublicos.length}</span></h2>
      <p class="ph-nota">Toca uno para ver el paso a paso.</p>
      <ul class="ph-flujos">${flujos}</ul></section>`;
}

export function montarPortada() {
  const app = document.getElementById('rr-app');
  const shell = document.querySelector('main.shell');
  if (!app || !shell || document.querySelector('[data-portada]')) return;
  const portada = document.createElement('section');
  portada.className = 'portada-hoy';
  portada.setAttribute('data-portada', '');
  portada.setAttribute('aria-label', 'Portada Hoy del Atlas');
  portada.innerHTML = html();
  shell.parentNode.insertBefore(portada, shell);

  const aplicar = () => {
    const h = String(location.hash || '');
    const enPortada = h === '' || h === '#' || h === '#hoy' || h === '#top';
    app.dataset.vista = enPortada ? 'hoy' : 'mapa';
    portada.hidden = !enPortada;
    if (!enPortada && h === '#mapa') {
      // El mapa se midió oculto: se encuadra de nuevo ya visible.
      requestAnimationFrame(() => document.querySelector('[data-action="fit"]')?.click());
    }
  };
  window.addEventListener('hashchange', aplicar);
  // Buscar o añadir un nodo desde la portada lleva al mapa (si no, no se veía nada).
  const alMapa = () => { if (app.dataset.vista === 'hoy') location.hash = '#mapa'; };
  document.querySelector('[data-search-input]')?.addEventListener('input', alMapa);
  document.querySelector('[data-action="search"]')?.addEventListener('click', alMapa, true);
  document.querySelector('.topbar [data-action="add-node"]')?.addEventListener('click', alMapa, true);
  aplicar();
}
