/* RR Aliados · Grafo documental — visor completo de la capa derivada.
   Sin dependencias. Lee ./grafo.json (mismo origen). Solo lectura.
   Paridad con output/graph.html: documentos, encabezados, conceptos y canvas. */
(() => {
  'use strict';

  const AREA_COLOR = {
    Mapa: '#be076d',
    Empresa: '#ded116',
    Procesos: '#4cc9f0',
    Capacidades: '#f72585',
    Productos: '#8bd450',
    Clientes: '#ff9f1c',
    Finanzas: '#7b61ff',
    Gobierno: '#e4572e',
    Sistema: '#9aa5b1',
    Inicio: '#ffffff',
    Derivado: '#5a4a52',
    Raíz: '#c9a9b8'
  };
  const KIND_COLOR = {
    page: null,
    heading: '#ded116',
    concept: '#7f8fa6',
    canvas: '#c04fd6',
    canvas_text: '#8e6fa8',
    canvas_file: '#6f8fa8',
    canvas_group: '#5a4a6a'
  };
  const KIND_ORDER = ['page', 'heading', 'canvas', 'canvas_text', 'canvas_file', 'canvas_group'];
  const ESTADOS = [
    ['vencido', 'Vencido'],
    ['vigente', 'Vigente'],
    ['sin_fecha', 'Sin fecha']
  ];
  const LIST_CAP = 400;

  const state = {
    data: null,
    nodes: [],
    edges: [],
    adj: [],
    pageSet: new Set(),
    q: '',
    areas: new Set(),
    kinds: new Set(),
    estados: new Set(),
    tipo: '',
    com: '',
    selected: null,
    hover: null,
    view: { x: 0, y: 0, k: 1 },
    visible: new Set()
  };

  const el = (id) => document.getElementById(id);
  const canvas = el('canvas');
  const ctx = canvas.getContext('2d');
  const tip = el('tip');

  /* ---------- carga ---------- */
  async function boot() {
    let payload;
    try {
      const res = await fetch('grafo.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      payload = await res.json();
    } catch (err) {
      el('detail').textContent = '';
      const p = document.createElement('p');
      p.className = 'g-empty';
      p.textContent = 'No se pudo cargar grafo.json: ' + err.message;
      el('detail').appendChild(p);
      return;
    }
    state.data = payload;
    state.nodes = payload.nodes || [];
    state.edges = payload.edges || [];
    state.pageSet = new Set(payload.docs || []);
    state.adj = state.nodes.map(() => []);
    for (const [s, t, rel, conf] of state.edges) {
      state.adj[s].push({ i: t, rel, conf, dir: 'out' });
      state.adj[t].push({ i: s, rel, conf, dir: 'in' });
    }
    buildFilters();
    fit();
    bind();
    apply();
    const hash = /[#&]n=(\d+)/.exec(location.hash);
    if (hash) select(Number(hash[1]), false);
  }

  /* ---------- filtros ---------- */
  function countBy(fn) {
    const m = new Map();
    for (const n of state.nodes) {
      const k = fn(n);
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }

  function chip(host, label, count, datasetKey, value, handler) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset[datasetKey] = value;
    b.setAttribute('aria-pressed', 'false');
    b.append(document.createTextNode(label));
    const c = document.createElement('span');
    c.className = 'c';
    c.textContent = count;
    b.appendChild(c);
    b.addEventListener('click', () => {
      const on = handler(value);
      b.setAttribute('aria-pressed', String(on));
    });
    host.appendChild(b);
  }

  function buildFilters() {
    const areas = el('f-area');
    for (const [name, n] of countBy((x) => (x.kind === 'page' ? x.area : ''))) {
      chip(areas, name, n, 'area', name, (v) => {
        state.areas.has(v) ? state.areas.delete(v) : state.areas.add(v);
        apply();
        return state.areas.has(v);
      });
    }
    const kinds = el('f-kind');
    for (const kind of KIND_ORDER) {
      const n = state.nodes.filter((x) => x.kind === kind).length;
      if (!n) continue;
      const label = state.nodes.find((x) => x.kind === kind).kind_label;
      chip(kinds, label, n, 'kind', kind, (v) => {
        state.kinds.has(v) ? state.kinds.delete(v) : state.kinds.add(v);
        apply();
        return state.kinds.has(v);
      });
    }
    const estados = el('f-estado');
    for (const [key, label] of ESTADOS) {
      const n = [...state.pageSet].filter((i) => state.nodes[i].estado === key).length;
      chip(estados, label, n, 'estado', key, (v) => {
        state.estados.has(v) ? state.estados.delete(v) : state.estados.add(v);
        apply();
        return state.estados.has(v);
      });
    }
    const tipos = el('f-tipo');
    for (const [name, n] of countBy((x) => (x.kind === 'page' ? x.tipo : ''))) {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name + ' (' + n + ')';
      tipos.appendChild(o);
    }
    const coms = el('f-com');
    for (const c of state.data.comunidades || []) {
      const o = document.createElement('option');
      o.value = c.nombre;
      o.textContent = c.nombre + ' (' + c.tam + ')';
      coms.appendChild(o);
    }
    const legend = el('legend');
    const items = [
      ['Documento', '#be076d'],
      ['Encabezado', KIND_COLOR.heading],
      ['Canvas', KIND_COLOR.canvas],
      ['Texto de canvas', KIND_COLOR.canvas_text],
      ['Archivo en canvas', KIND_COLOR.canvas_file],
      ['Grupo de canvas', KIND_COLOR.canvas_group]
    ];
    for (const [name, color] of items) {
      const s = document.createElement('span');
      const i = document.createElement('i');
      i.style.background = color;
      s.append(i, document.createTextNode(name));
      legend.appendChild(s);
    }
  }

  function matches(n) {
    const isPage = n.kind === 'page';
    if (state.kinds.size && !state.kinds.has(n.kind)) return false;
    if (state.areas.size && (!isPage || !state.areas.has(n.area))) return false;
    if (state.estados.size && (!isPage || !state.estados.has(n.estado))) return false;
    if (state.tipo && (!isPage || n.tipo !== state.tipo)) return false;
    if (state.com && n.community_name !== state.com) return false;
    if (!state.q) return true;
    const q = state.q.toLowerCase();
    return (n.label + ' ' + (n.file || '') + ' ' + (n.owner || '') + ' ' + (n.tipo || '') + ' ' + n.community_name)
      .toLowerCase()
      .includes(q);
  }

  function apply() {
    const visible = [];
    for (let i = 0; i < state.nodes.length; i++) if (matches(state.nodes[i])) visible.push(i);
    state.visible = new Set(visible);
    renderList(visible);
    renderStats(visible.length);
    if (state.selected !== null && !state.visible.has(state.selected)) {
      state.selected = null;
      renderDetail();
    }
    draw();
  }

  function renderStats(shown) {
    const m = state.data.meta;
    el('stats').textContent = '';
    const b1 = document.createElement('b');
    b1.textContent = shown + '/' + m.nodos;
    const b2 = document.createElement('b');
    b2.textContent = m.relaciones;
    const b3 = document.createElement('b');
    b3.textContent = m.documentos;
    const b4 = document.createElement('b');
    b4.textContent = m.drive_docs || 0;
    el('stats').append(
      b1, document.createTextNode(' nodos · '),
      b2, document.createTextNode(' relaciones · '),
      b3, document.createTextNode(' docs · '),
      b4, document.createTextNode(' con Drive · ' + m.generado)
    );
  }

  function renderList(visible) {
    const list = el('list');
    list.textContent = '';
    const sorted = [...visible].sort(
      (a, b) => state.nodes[b].degree - state.nodes[a].degree || state.nodes[a].label.localeCompare(state.nodes[b].label)
    );
    el('list-count').textContent =
      sorted.length > LIST_CAP
        ? sorted.length + ' nodos · mostrando los ' + LIST_CAP + ' más conectados'
        : sorted.length + ' nodos';
    const frag = document.createDocumentFragment();
    for (const i of sorted.slice(0, LIST_CAP)) {
      const n = state.nodes[i];
      const li = document.createElement('li');
      li.dataset.i = i;
      if (state.selected === i) li.setAttribute('aria-current', 'true');
      const left = document.createElement('div');
      const t = document.createElement('div');
      t.className = 't';
      t.textContent = n.label;
      const p = document.createElement('div');
      p.className = 'p';
      p.textContent = n.kind_label + (n.area ? ' · ' + n.area : '') + (n.file ? ' · ' + n.file : '');
      left.append(t, p);
      const deg = document.createElement('span');
      deg.className = 'd';
      deg.textContent = n.degree;
      li.append(left, deg);
      li.addEventListener('click', () => select(i));
      frag.appendChild(li);
    }
    list.appendChild(frag);
  }

  /* ---------- detalle ---------- */
  function renderDetail() {
    const box = el('detail');
    box.textContent = '';
    if (state.selected === null) {
      const p = document.createElement('p');
      p.className = 'g-empty';
      p.textContent = 'Selecciona un nodo en el mapa o en la lista.';
      box.appendChild(p);
      return;
    }
    const n = state.nodes[state.selected];
    const isPage = n.kind === 'page';
    const h2 = document.createElement('h2');
    h2.textContent = isPage ? n.title : n.label;
    const path = document.createElement('div');
    path.className = 'path';
    path.textContent = n.file || n.id;

    const badges = document.createElement('div');
    badges.className = 'g-badges';
    const mk = (text, cls) => {
      const s = document.createElement('span');
      s.className = 'g-badge' + (cls ? ' ' + cls : '');
      s.textContent = text;
      badges.appendChild(s);
    };
    mk(n.kind_label);
    if (isPage) {
      mk(n.area);
      if (n.tipo) mk(n.tipo);
      mk(ESTADOS.find((e) => e[0] === n.estado)[1], n.estado);
    }
    mk(n.degree + ' vínculos');
    if (isPage && n.drive_url) mk('Drive ✓');

    const kv = document.createElement('dl');
    kv.className = 'g-kv';
    const row = (k, v) => {
      if (!v) return;
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      kv.append(dt, dd);
    };
    if (isPage) {
      row('Owner', n.owner);
      row('Corte', n.corte);
      row('Revisar', n.revisar);
      row('Vigente', n.vigente_hasta);
      row('Capacidad', n.capacidad);
      row('Drive', n.drive_id);
      row('Versión Drive', n.drive_version);
      row('Modificado', (n.drive_modified || '').slice(0, 10));
      row('MD5', (n.drive_md5 || '').slice(0, 12));
    }
    row('Archivo', n.file);
    row('Comunidad', n.community_name);
    row('Tipo de grafo', n.type);

    const actions = document.createElement('div');
    actions.className = 'g-actions';
    if (isPage && n.drive_url) {
      const dr = document.createElement('a');
      dr.className = 'primary';
      dr.href = n.drive_url;
      dr.target = '_blank';
      dr.rel = 'noopener';
      dr.textContent = 'Abrir en Drive';
      actions.appendChild(dr);
    }
    if (isPage && n.obsidian) {
      const ob = document.createElement('a');
      ob.href = n.obsidian;
      ob.textContent = 'Abrir en Obsidian';
      actions.appendChild(ob);
    }
    const copy = document.createElement('a');
    copy.href = '#n=' + state.selected;
    copy.textContent = 'Enlace a este nodo';
    actions.appendChild(copy);

    const h3rels = document.createElement('h3');
    h3rels.textContent = 'Vinculados';
    const rels = document.createElement('ul');
    rels.className = 'g-rel';
    const neigh = state.adj[state.selected] || [];
    if (!neigh.length) {
      const li = document.createElement('li');
      li.textContent = 'Sin relaciones.';
      rels.appendChild(li);
    }
    for (const x of neigh.slice(0, 30)) {
      const other = state.nodes[x.i];
      const li = document.createElement('li');
      li.textContent = other.label;
      const r = document.createElement('span');
      r.className = 'r';
      r.textContent = (x.dir === 'out' ? '→ ' : '← ') + x.rel;
      li.appendChild(r);
      li.addEventListener('click', () => select(x.i));
      rels.appendChild(li);
    }

    box.append(h2, path, badges, kv, actions, h3rels, rels);
  }

  function select(i, push = true) {
    if (!Number.isInteger(i) || !state.nodes[i]) return;
    state.selected = i;
    if (push) history.replaceState(null, '', '#n=' + i);
    renderDetail();
    for (const li of el('list').children) {
      if (Number(li.dataset.i) === i) li.setAttribute('aria-current', 'true');
      else li.removeAttribute('aria-current');
    }
    draw();
  }

  /* ---------- dibujo ---------- */
  let raf = 0;
  function draw() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(paint);
  }

  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!state.nodes.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of state.nodes) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    }
    const pad = 40;
    const k = Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1));
    state.view.k = Math.max(0.05, Math.min(k, 4));
    state.view.x = w / 2 - ((minX + maxX) / 2) * state.view.k;
    state.view.y = h / 2 - ((minY + maxY) / 2) * state.view.k;
  }

  function toScreen(n) {
    return { x: n.x * state.view.k + state.view.x, y: n.y * state.view.k + state.view.y };
  }

  function paint() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      fit();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const k = state.view.k;
    ctx.lineWidth = Math.max(0.4, Math.min(1.2, 0.7 * k));
    for (const [s, t] of state.edges) {
      const a = state.visible.has(s), b = state.visible.has(t);
      if (!a && !b) continue;
      const p1 = toScreen(state.nodes[s]), p2 = toScreen(state.nodes[t]);
      const hot = state.selected === s || state.selected === t;
      ctx.strokeStyle = hot
        ? 'rgba(222,209,22,.85)'
        : a && b
          ? 'rgba(190,7,109,.26)'
          : 'rgba(120,90,105,.08)';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    for (let i = 0; i < state.nodes.length; i++) {
      const n = state.nodes[i];
      const on = state.visible.has(i);
      if (!on && state.view.k < 0.35) continue;
      const p = toScreen(n);
      const base = n.kind === 'page' ? 4.4 : n.kind === 'canvas' ? 3.6 : 2.1;
      const r = Math.min(11, base + Math.sqrt(n.degree) * 0.55) * Math.max(0.55, Math.min(k, 2.2));
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.2, r), 0, Math.PI * 2);
      const color = n.kind === 'page' ? AREA_COLOR[n.area] || '#c9a9b8' : KIND_COLOR[n.kind] || '#7f8fa6';
      ctx.fillStyle = color;
      ctx.globalAlpha = on ? 0.9 : 0.18;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (state.selected === i) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (state.hover === i) {
        ctx.strokeStyle = '#ded116';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
  }

  /* ---------- interacción ---------- */
  function hit(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    let best = null, bestD = 12;
    for (let i = 0; i < state.nodes.length; i++) {
      if (!state.visible.has(i)) continue;
      const p = toScreen(state.nodes[i]);
      const dd = Math.hypot(p.x - x, p.y - y);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    return best;
  }

  function bind() {
    const q = el('q');
    q.addEventListener('input', () => { state.q = q.value.trim(); apply(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); }
      if (e.key === 'Escape' && document.activeElement === q) { q.value = ''; state.q = ''; apply(); q.blur(); }
    });

    el('f-tipo').addEventListener('change', (e) => { state.tipo = e.target.value; apply(); });
    el('f-com').addEventListener('change', (e) => { state.com = e.target.value; apply(); });
    el('reset').addEventListener('click', () => {
      state.q = ''; q.value = '';
      state.areas.clear(); state.kinds.clear(); state.estados.clear();
      state.tipo = ''; state.com = '';
      document.querySelectorAll('.g-chips button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      el('f-tipo').value = ''; el('f-com').value = '';
      apply(); fit(); draw();
    });
    el('toggle-list').addEventListener('click', (e) => {
      const wrap = document.querySelector('.g-list-wrap');
      const hidden = wrap.hasAttribute('hidden');
      hidden ? wrap.removeAttribute('hidden') : wrap.setAttribute('hidden', '');
      e.target.textContent = hidden ? 'Ocultar lista' : 'Mostrar lista';
      draw();
    });

    canvas.addEventListener('mousemove', (e) => {
      const i = hit(e.clientX, e.clientY);
      if (i !== state.hover) { state.hover = i; draw(); }
      if (i === null) { tip.hidden = true; return; }
      const n = state.nodes[i];
      tip.hidden = false;
      tip.textContent = n.label + ' · ' + n.kind_label;
      const rect = canvas.getBoundingClientRect();
      tip.style.left = Math.min(e.clientX - rect.left + 12, rect.width - 240) + 'px';
      tip.style.top = Math.max(6, e.clientY - rect.top - 12) + 'px';
    });
    canvas.addEventListener('mouseleave', () => { tip.hidden = true; state.hover = null; draw(); });

    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, vx: state.view.x, vy: state.view.y, moved: false };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      state.view.x = drag.vx + dx;
      state.view.y = drag.vy + dy;
      draw();
    });
    canvas.addEventListener('pointerup', (e) => {
      if (drag && !drag.moved) {
        const i = hit(e.clientX, e.clientY);
        if (i !== null) select(i);
      }
      drag = null;
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const k2 = Math.max(0.05, Math.min(8, state.view.k * (e.deltaY < 0 ? 1.12 : 0.89)));
      state.view.x = mx - (mx - state.view.x) * (k2 / state.view.k);
      state.view.y = my - (my - state.view.y) * (k2 / state.view.k);
      state.view.k = k2;
      draw();
    }, { passive: false });

    window.addEventListener('resize', () => { fit(); draw(); });
  }

  boot();
})();
