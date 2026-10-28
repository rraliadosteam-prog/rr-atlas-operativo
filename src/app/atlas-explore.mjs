import { ECOSYSTEM_ENTRIES } from '../data/ecosystem-catalog.mjs';

(function bindAtlasExplore() {
  const app = document.getElementById('atlas-app');
  if (!app) return;

  const navTabs = document.querySelectorAll('.atlas-nav-tabs button');
  const tabbarTabs = document.querySelectorAll('.atlas-tabbar button');
  const allNavButtons = [...navTabs, ...tabbarTabs];
  const TYPE_MAP = {
    clientes: ['Cliente'],
    procesos: ['Proceso'],
    productos: ['Producto propio', 'Producto reutilizable'],
    areas: ['Area'],
    talento: ['Talento'],
    herramientas: ['Herramienta'],
    gobierno: ['Gobierno', 'Control'],
    finanzas: ['Finanzas'],
  };
  const TYPE_LABELS = {
    clientes: 'Clientes',
    procesos: 'Procesos',
    productos: 'Productos',
    areas: 'Areas',
    talento: 'Talento',
    herramientas: 'Herramientas',
    gobierno: 'Gobierno',
    finanzas: 'Finanzas',
  };
  const CATALOG_FILTERS = ['Todos', 'Clientes', 'Internos', 'Prototipos', 'En produccion', 'Entregados', 'Pausados/Archivo', 'Sin URL'];
  const STORAGE_KEY = 'atlas-ecosystem-overrides-v1';
  const graphNodes = () => (window.DEFAULT_GRAPH?.data || []);
  let currentSection = app.dataset.atlasSection || 'inicio';
  let exploreMode = 'graph';
  let exploreNodes = [];
  let activeCatalogFilter = 'Todos';
  let catalogView = 'trabajo';
  let catalogOverrides = loadOverrides();

  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const normalize = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const safeUrl = (value) => !value || value.startsWith('/') || /^https?:\/\//i.test(value);

  function loadOverrides() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return value ? JSON.parse(value) : {};
    } catch {
      return {};
    }
  }

  function persistOverrides() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(catalogOverrides));
    } catch {
      /* El catalogo sigue navegable aunque el almacenamiento este bloqueado. */
    }
  }

  function mergedCatalogEntries() {
    return ECOSYSTEM_ENTRIES.map((entry) => ({
      ...entry,
      ...(catalogOverrides[entry.id] || {}),
    }));
  }

  function catalogFilterMatches(entry, filter) {
    if (filter === 'Todos') return true;
    if (filter === 'Clientes') return entry.kind === 'cliente';
    if (filter === 'Internos') return entry.kind === 'interno';
    if (filter === 'Prototipos') return entry.tags.includes('prototipo');
    if (filter === 'En produccion') return entry.tags.includes('produccion');
    if (filter === 'Entregados') return entry.tags.includes('entregado');
    if (filter === 'Sin URL') return !entry.url;
    return entry.tags.includes('pausado') || entry.tags.includes('archivo');
  }

  function catalogNode(entry) {
    return {
      id: entry.id,
      title: entry.name,
      desc: entry.description,
      type: entry.kind === 'cliente' ? 'Cliente' : 'RR Aliados',
      owner: entry.client || 'DESCONOCIDO',
      status: entry.state,
      url: entry.url || '',
      path: entry.path || '',
      source: entry.source,
      cut: entry.cut,
      note: entry.note || '',
      tags: entry.tags,
      catalogEntry: entry,
    };
  }

  function filteredCatalogNodes() {
    const query = normalize($('[data-explore-search]')?.value || '');
    return mergedCatalogEntries()
      .filter((entry) => catalogFilterMatches(entry, activeCatalogFilter))
      .filter((entry) => {
        if (!query) return true;
        return [entry.name, entry.description, entry.client, entry.state, entry.source, entry.url, entry.path]
          .filter(Boolean)
          .some((value) => normalize(value).includes(query));
      })
      .map(catalogNode);
  }

  function switchTo(section) {
    currentSection = section;
    if (section !== 'explore' && typeof window.__atlasSetSection === 'function') {
      window.__atlasSetSection(section);
      const explore = app.querySelector('[data-atlas-explore]');
      if (explore) explore.hidden = true;
      $('[data-explore-panel]')?.classList.remove('open');
      allNavButtons.forEach((button) => {
        const active = button.dataset.atlasSectionTarget === section;
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('active', active);
      });
      return;
    }
    app.dataset.atlasSection = section;
    const home = app.querySelector('[data-atlas-home]');
    const processes = app.querySelector('[data-atlas-process]');
    const plan = app.querySelector('[data-atlas-plan]');
    const explore = app.querySelector('[data-atlas-explore]');
    if (home) home.hidden = section !== 'inicio';
    if (processes) processes.hidden = section !== 'procesos';
    if (plan) plan.hidden = section !== 'plan';
    if (explore) explore.hidden = section !== 'explore';
    allNavButtons.forEach((button) => {
      const active = button.dataset.atlasSectionTarget === section;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('active', active);
    });
    if (section !== 'explore') $('[data-explore-panel]')?.classList.remove('open');
  }

  allNavButtons.forEach((button) => button.addEventListener('click', () => switchTo(button.dataset.atlasSectionTarget)));

  function renderExploreControls() {
    const controls = $('[data-explore-catalog-controls]');
    if (!controls) return;
    controls.hidden = exploreMode !== 'catalog';
    if (exploreMode !== 'catalog') {
      controls.replaceChildren();
      return;
    }
    controls.innerHTML = `
      <div class="atlas-catalog-filters" role="group" aria-label="Filtrar ecosistema">
        ${CATALOG_FILTERS.map((filter) => `<button type="button" class="atlas-catalog-filter" data-catalog-filter="${escapeHtml(filter)}" aria-pressed="${String(filter === activeCatalogFilter)}">${escapeHtml(filter)}</button>`).join('')}
      </div>
      <div class="atlas-catalog-view" role="group" aria-label="Cambiar vista del catalogo">
        <button type="button" class="atlas-catalog-view-button" data-catalog-view="resumen" aria-pressed="${String(catalogView === 'resumen')}">Resumen</button>
        <button type="button" class="atlas-catalog-view-button" data-catalog-view="trabajo" aria-pressed="${String(catalogView === 'trabajo')}">Trabajo</button>
        <button type="button" class="atlas-catalog-clear" data-catalog-clear>Limpiar cambios locales</button>
      </div>`;
    controls.querySelectorAll('[data-catalog-filter]').forEach((button) => button.addEventListener('click', () => {
      activeCatalogFilter = button.dataset.catalogFilter;
      renderExploreControls();
      renderCatalog();
    }));
    controls.querySelectorAll('[data-catalog-view]').forEach((button) => button.addEventListener('click', () => {
      catalogView = button.dataset.catalogView;
      renderExploreControls();
      renderCatalog();
    }));
    controls.querySelector('[data-catalog-clear]')?.addEventListener('click', () => {
      if (!window.confirm('¿Limpiar los cambios locales del catalogo?')) return;
      catalogOverrides = {};
      persistOverrides();
      renderExploreControls();
      renderCatalog();
    });
  }

  function openExplore(category) {
    exploreMode = 'graph';
    renderExploreControls();
    const types = TYPE_MAP[category] || ['Cliente'];
    const label = TYPE_LABELS[category] || 'Items';
    $('[data-explore-kind]').textContent = 'Categoria';
    $('[data-explore-heading]').textContent = label;
    $('[data-explore-search]').value = '';
    $('[data-explore-search]').placeholder = `Buscar en ${label.toLowerCase()}`;
    exploreNodes = graphNodes().filter((node) => types.includes(node.type));
    $('[data-explore-count]').textContent = `${exploreNodes.length} items`;
    renderGraphGrid(exploreNodes);
    switchTo('explore');
  }

  function openCatalog() {
    exploreMode = 'catalog';
    activeCatalogFilter = 'Todos';
    catalogView = 'trabajo';
    $('[data-explore-kind]').textContent = 'Ecosistema RR Aliados';
    $('[data-explore-heading]').textContent = 'Todos los desarrollos.';
    $('[data-explore-search]').value = '';
    $('[data-explore-search]').placeholder = 'Buscar por nombre, cliente o destino';
    renderExploreControls();
    renderCatalog();
    switchTo('explore');
  }

  function renderGraphGrid(nodes) {
    const grid = $('[data-explore-grid]');
    if (!grid) return;
    grid.innerHTML = nodes.map((node) => `
      <article class="explore-card" data-node-id="${escapeHtml(node.id)}">
        <div class="explore-card-type"><span class="dot"></span>${escapeHtml(node.type)}</div>
        <h3>${escapeHtml(node.title)}</h3>
        <p>${escapeHtml(node.desc || '')}</p>
        <div class="explore-card-meta"><span>${escapeHtml(node.owner || 'DESCONOCIDO')}</span><span>${escapeHtml(node.status || 'Por validar')}</span></div>
        <div class="explore-card-actions"><button type="button" data-action="view-detail" data-id="${escapeHtml(node.id)}">Ver detalle</button><button type="button" data-action="view-map" data-id="${escapeHtml(node.id)}">Ver en mapa</button></div>
      </article>`).join('');
    bindGridActions();
  }

  function renderCatalog() {
    const nodes = filteredCatalogNodes();
    exploreNodes = nodes;
    $('[data-explore-count]').textContent = `${nodes.length} visibles / ${ECOSYSTEM_ENTRIES.length} registros`;
    const grid = $('[data-explore-grid]');
    if (!grid) return;
    if (catalogView === 'resumen') {
      grid.classList.add('is-catalog-summary');
      grid.innerHTML = nodes.map((node) => `
        <div class="atlas-catalog-row" data-node-id="${escapeHtml(node.id)}">
          <button type="button" class="atlas-catalog-row-main" data-action="view-detail" data-id="${escapeHtml(node.id)}"><strong>${escapeHtml(node.title)}</strong><span>${escapeHtml(node.type)}</span><span>${escapeHtml(node.owner)}</span><span class="atlas-catalog-status">${escapeHtml(node.status)}</span><span class="atlas-catalog-url">${escapeHtml(node.url || 'FALTA URL')}</span></button>
          <button type="button" class="atlas-catalog-edit" data-action="edit-catalog" data-id="${escapeHtml(node.id)}">Editar</button>
        </div>`).join('');
    } else {
      grid.classList.remove('is-catalog-summary');
      grid.innerHTML = nodes.map((node) => `
        <article class="explore-card atlas-catalog-card ${node.url ? '' : 'is-missing-url'}" data-node-id="${escapeHtml(node.id)}">
          <div class="explore-card-type"><span class="dot"></span>${escapeHtml(node.type)} · ${escapeHtml(node.status)}</div>
          <h3>${escapeHtml(node.title)}</h3>
          <p>${escapeHtml(node.desc)}</p>
          <div class="explore-card-meta"><span>${escapeHtml(node.owner)}</span><span>${escapeHtml(node.url || 'FALTA URL')}</span></div>
          <small class="atlas-catalog-source">${escapeHtml(node.source)} · corte ${escapeHtml(node.cut)}</small>
          <div class="explore-card-actions"><button type="button" data-action="open-catalog" data-id="${escapeHtml(node.id)}">${node.url ? 'Abrir proyecto' : 'Agregar URL'}</button><button type="button" data-action="view-detail" data-id="${escapeHtml(node.id)}">Ver ficha</button><button type="button" data-action="edit-catalog" data-id="${escapeHtml(node.id)}">Editar</button></div>
        </article>`).join('');
    }
    bindGridActions();
  }

  function bindGridActions() {
    const grid = $('[data-explore-grid]');
    if (!grid) return;
    grid.querySelectorAll('.explore-card').forEach((card) => card.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      openDetail(card.dataset.nodeId);
    }));
    grid.querySelectorAll('[data-action="view-detail"]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      openDetail(button.dataset.id);
    }));
    grid.querySelectorAll('[data-action="view-map"]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      goToMap(button.dataset.id);
    }));
    grid.querySelectorAll('[data-action="open-catalog"]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      openCatalogEntry(button.dataset.id);
    }));
    grid.querySelectorAll('[data-action="edit-catalog"]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      openCatalogEditor(button.dataset.id);
    }));
  }

  function findNode(id) {
    return exploreNodes.find((node) => node.id === id) || graphNodes().find((node) => node.id === id);
  }

  function openDetail(nodeId) {
    const node = findNode(nodeId);
    if (!node) return;
    const content = $('[data-explore-panel-content]');
    const panel = $('[data-explore-panel]');
    if (!content || !panel) return;
    const catalog = node.catalogEntry;
    if (catalog) {
      content.innerHTML = catalogDetailMarkup(node);
      bindCatalogDetail(node);
    } else {
      content.innerHTML = graphDetailMarkup(node);
      content.querySelector('[data-action="panel-view-map"]')?.addEventListener('click', () => goToMap(node.id));
    }
    panel.classList.add('open');
  }

  function graphDetailMarkup(node) {
    return `<div class="panel-type">${escapeHtml(node.type)}</div><h2>${escapeHtml(node.title)}</h2><div class="panel-section"><h4>Descripcion</h4><p>${escapeHtml(node.desc || 'Sin descripcion')}</p></div><div class="panel-section"><h4>Informacion</h4><div class="meta-row"><span class="label">Responsable</span><span class="value">${escapeHtml(node.owner || 'DESCONOCIDO')}</span></div><div class="meta-row"><span class="label">Estado</span><span class="value">${escapeHtml(node.status || 'Por validar')}</span></div><div class="meta-row"><span class="label">ID</span><span class="value">${escapeHtml(node.id)}</span></div></div><div class="panel-section"><h4>Acciones</h4><button class="action-btn" data-action="panel-view-map" type="button">Ver en mapa</button></div>`;
  }

  function catalogDetailMarkup(node) {
    const entry = node.catalogEntry;
    return `<div class="panel-type">${escapeHtml(node.type)} · ${escapeHtml(node.status)}</div><h2>${escapeHtml(node.title)}</h2><div class="panel-section"><h4>Descripcion</h4><p>${escapeHtml(node.desc)}</p></div><div class="panel-section"><h4>Fuente y corte</h4><div class="meta-row"><span class="label">Fuente</span><span class="value">${escapeHtml(node.source)}</span></div><div class="meta-row"><span class="label">Corte</span><span class="value">${escapeHtml(node.cut)}</span></div>${node.note ? `<p class="atlas-catalog-note">${escapeHtml(node.note)}</p>` : ''}</div><div class="panel-section"><h4>Acciones</h4><button class="action-btn" data-action="catalog-open" type="button">${node.url ? 'Abrir proyecto' : 'Agregar URL'}</button><button class="action-btn" data-action="catalog-edit" type="button">Editar ficha</button><button class="action-btn" data-action="panel-view-map" type="button">Buscar en mapa</button><p class="atlas-catalog-form-error" data-catalog-error role="status"></p></div><form class="atlas-catalog-editor" data-catalog-editor hidden><label>URL<input name="url" value="${escapeHtml(node.url)}" placeholder="https://..." /></label><label>Descripcion<textarea name="description" rows="3">${escapeHtml(node.desc)}</textarea></label><label>Estado<input name="state" value="${escapeHtml(node.status)}" /></label><label>Cliente asociado<input name="client" value="${escapeHtml(entry.client || '')}" placeholder="DESCONOCIDO" /></label><label>Ruta interna<input name="path" value="${escapeHtml(entry.path || '')}" placeholder="DESCONOCIDO" /></label><p class="atlas-catalog-form-error" data-catalog-error hidden></p><div class="atlas-catalog-editor-actions"><button type="submit" class="action-btn">Guardar cambios</button><button type="button" class="action-btn" data-action="catalog-restore">Restaurar original</button></div></form>`;
  }

  function bindCatalogDetail(node) {
    const content = $('[data-explore-panel-content]');
    content.querySelector('[data-action="catalog-open"]')?.addEventListener('click', () => openCatalogEntry(node.id));
    content.querySelector('[data-action="catalog-edit"]')?.addEventListener('click', () => {
      const editor = content.querySelector('[data-catalog-editor]');
      editor.hidden = !editor.hidden;
      editor.querySelector('input[name="url"]')?.focus();
    });
    content.querySelector('[data-action="panel-view-map"]')?.addEventListener('click', () => {
      const graph = findMapNode(node);
      if (graph) goToMap(graph.id);
      else content.querySelector('[data-catalog-error]')?.replaceChildren(document.createTextNode('Esta ficha no tiene un nodo equivalente en el mapa resumido.'));
    });
    content.querySelector('[data-action="catalog-restore"]')?.addEventListener('click', () => {
      delete catalogOverrides[node.id];
      persistOverrides();
      openCatalogEditor(node.id, true);
      renderCatalog();
    });
    content.querySelector('[data-catalog-editor]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const url = String(formData.get('url') || '').trim();
      const error = form.querySelector('[data-catalog-error]');
      if (url && !safeUrl(url)) {
        error.textContent = 'URL invalida. Usa una direccion http://, https:// o una ruta interna.';
        error.hidden = false;
        return;
      }
      catalogOverrides[node.id] = {
        url,
        description: String(formData.get('description') || '').trim(),
        state: String(formData.get('state') || '').trim(),
        client: String(formData.get('client') || '').trim(),
        path: String(formData.get('path') || '').trim(),
      };
      persistOverrides();
      error.hidden = true;
      renderExploreControls();
      renderCatalog();
      openDetail(node.id);
    });
  }

  function openCatalogEditor(id, restoreOnly = false) {
    const node = mergedCatalogEntries().map(catalogNode).find((entry) => entry.id === id);
    if (!node) return;
    openDetail(id);
    const editor = $('[data-catalog-editor]');
    if (editor) {
      editor.hidden = false;
      if (!restoreOnly) editor.querySelector('input[name="url"]')?.focus();
    }
  }

  function openCatalogEntry(id) {
    const node = mergedCatalogEntries().map(catalogNode).find((entry) => entry.id === id);
    if (!node) return;
    if (!node.url) {
      openCatalogEditor(id);
      return;
    }
    if (!safeUrl(node.url)) return;
    if (node.url.startsWith('/')) window.location.assign(node.url);
    else window.open(node.url, '_blank', 'noopener,noreferrer');
  }

  function findMapNode(catalogNodeValue) {
    const key = normalize(catalogNodeValue.title);
    const aliases = {
      'mega dashboard': 'tool_004',
      'dashweb': 'prod_001',
      'buen puente': 'prod_002',
      'sazon alacena': 'prod_003',
      'atlas operativo': 'prod_004',
    };
    const alias = Object.entries(aliases).find(([name]) => key.includes(name));
    return alias ? graphNodes().find((node) => node.id === alias[1]) : graphNodes().find((node) => normalize(node.title) === key);
  }

  function goToMap(nodeId) {
    $('[data-explore-panel]')?.classList.remove('open');
    switchTo('mapa');
    window.__atlas_selected_node = nodeId;
  }

  document.querySelectorAll('.atlas-home-card').forEach((card) => card.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    const nav = card.dataset.homeNav;
    if (nav === 'procesos') switchTo('procesos');
    else if (nav === 'plan') switchTo('plan');
    else if (nav === 'ecosistema') openCatalog();
    else openExplore(nav);
  }));

  $('[data-explore-search]')?.addEventListener('input', () => {
    if (exploreMode === 'catalog') renderCatalog();
    else {
      const query = normalize($('[data-explore-search]').value);
      renderGraphGrid(exploreNodes.filter((node) => [node.title, node.desc, node.owner, node.status].some((value) => normalize(value).includes(query))));
    }
  });
  $('[data-action="explore-back"]')?.addEventListener('click', () => switchTo('inicio'));
  $('[data-action="close-explore-panel"]')?.addEventListener('click', () => $('[data-explore-panel]')?.classList.remove('open'));
  $('[data-atlas-backdrop]')?.addEventListener('click', () => $('[data-explore-panel]')?.classList.remove('open'));

  switchTo(currentSection);
  const count = $('[data-ecosystem-count]');
  if (count) count.textContent = `${ECOSYSTEM_ENTRIES.length} registros`;
})();
