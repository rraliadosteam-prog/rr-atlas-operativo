export function createAtlasShell({ root }) {
  const icons = {
    Todo: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    Gobierno: 'M12 3l8 4v6c0 4-4 7-8 9-4-2-8-5-8-9V7z M8 12l3 3 5-6',
    Proceso: 'M4 4h6v6H4z M14 14h6v6h-6z M10 7h7v7 M14 11l3 3 3-3',
    Cliente: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 7 M20 21v-2a4 4 0 0 0-3-4',
    Producto: 'M12 3l9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9 M7 5l9 5',
    Area: 'M4 21V3h16v18 M2 21h20 M8 7h2 M14 7h2 M8 11h2 M14 11h2 M10 21v-6h4v6',
    Talento: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M5 21v-2a7 7 0 0 1 14 0v2',
    Herramienta: 'M14 4a6 6 0 0 0-7 8L2 17a3 3 0 0 0 5 5l5-5a6 6 0 0 0 8-7l-4 4-4-4z',
    procesos: 'M2 4h20v16H2z M7 4v16 M7 12h15 M10 7h4v3h-4z M15 15h4v3h-4z',
    plan: 'M4 4h16v18H4z M8 2v4 M16 2v4 M8 11l2 2 4-4 M8 17h8',
  };
  root.querySelectorAll('.atlas-rail-mark').forEach((marker) => {
    const button = marker.parentElement;
    const key = button.dataset.atlasFilter || button.dataset.atlasSectionTarget;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [name, value] of Object.entries({ viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) svg.setAttribute(name, value);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', icons[key] || icons.Todo);
    svg.appendChild(path);
    marker.replaceChildren(svg);
  });
  const focusButton = root.querySelector('[data-action="toggle-focus"]');
  const setFocused = (focused) => {
    root.classList.toggle('is-focused', focused);
    focusButton?.setAttribute('aria-pressed', String(focused));
    if (focusButton) focusButton.title = focused ? 'Salir del enfoque · tecla \\' : 'Modo enfoque · tecla \\';
  };
  focusButton?.addEventListener('click', () => setFocused(!root.classList.contains('is-focused')));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setFocused(false);
    if (event.key !== '\\' || event.ctrlKey || event.metaKey || event.altKey || root.dataset.atlasSection !== 'mapa') return;
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    setFocused(!root.classList.contains('is-focused'));
  });
  const layout = root.querySelector('[data-atlas-layout]');
  const toggle = root.querySelector('[data-action="toggle-rail"]');
  if (!layout || !toggle) return { collapse: () => {} };

  const setCollapsed = (collapsed) => {
    layout.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-pressed', String(collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Mostrar navegación' : 'Contraer navegación');
    toggle.title = collapsed ? 'Mostrar navegación' : 'Contraer navegación';
  };

  toggle.addEventListener('click', () => {
    setCollapsed(!layout.classList.contains('is-collapsed'));
  });

  setCollapsed(false);
  const desktopQuery = window.matchMedia?.('(min-width: 761px)');
  desktopQuery?.addEventListener?.('change', (event) => {
    if (!event.matches) setCollapsed(false);
  });

  return Object.freeze({
    collapse: setCollapsed,
  });
}
