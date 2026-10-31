/* RR Aliados · Grafo documental — visor de la capa derivada.
   Sin dependencias. Lee ./grafo.json (mismo origen). Solo lectura. */
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
  const ESTADOS = [
    ['vencido', 'Vencido'],
    ['vigente', 'Vigente'],
    ['sin_fecha', 'Sin fecha']
  ];

  const state = {
    data: null,
    docs: [],
    edges: [],
    adj: [],
    q: '',
    areas: new Set(),
    estados: new Set(),
    tipo: '',
    com: '',
    selected: null,
    hover: null,
    view: { x: 0, y: 0, k: 1 },
    pos: [],
    vel: [],
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
    state.docs = payload.docs || [];
    state.edges = payload.edges || [];
    state.adj = state.docs.map(() => []);
    for (const [s, t, rel, conf] of state.edges) {
      state.adj[s].push({ i: t, rel, conf, dir: 'out' });
      state.adj[t].push({ i: s, rel, conf, dir: 'in' });
    }
    buildFilters();
    layout();
    bind();
    apply();
    const hash = /doc=(\d+)/.exec(location.hash);
    if (hash) select(Number(hash[1]), false);
  }

  /* ---------- filtros ---------- */
  function countBy(key) {
    const m = new Map();
    for (const d of state.docs) m.set(d[key], (m.get(d[key]) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }

  function buildFilters() {
    const areas = el('f-area');
    for (const [name, n] of countBy('area')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.area = name;
      b.setAttribute('aria-pressed', 'false');
      b.append(document.createTextNode(name));
      const c = document.createElement('span');
      c.className = 'c';
      c.textContent = n;
      b.appendChild(c);
      areas.appendChild(b);
    }
    const estados = el('f-estado');
    for (const [key, label] of ESTADOS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.estado = key;
      b.setAttribute('aria-pressed', 'false');
      const n = state.docs.filter((d) => d.estado === key).length;
      b.append(document.createTextNode(label));
      const c = document.createElement('span');
      c.className = 'c';
      c.textContent = n;
      b.appendChild(c);
      estados.appendChild(b);
    }
    const tipos = el('f-tipo');
    for (const [name, n] of countBy('tipo')) {
      if (!name) continue;
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
    for (const [name, color] of Object.entries(AREA_COLOR)) {
      if (!state.docs.some((d) => d.area === name)) continue;
      const s = document.createElement('span');
      const i = document.createElement('i');
      i.style.background = color;
      s.append(i, document.createTextNode(name));
      legend.appendChild(s);
    }
  }

  function matches(d) {
    if (state.areas.size && !state.areas.has(d.area)) return false;
    if (state.estados.size && !state.estados.has(d.estado)) return false;
    if (state.tipo && d.tipo !== state.tipo) return false;
    if (state.com && d.comunidad_nombre !== state.com) return false;
    if (!state.q) return true;
    const q = state.q.toLowerCase();
    const hay = [
      d.title, d.file, d.owner, d.tipo, d.area, d.capacidad,
      d.comunidad_nombre, ...(d.headings || [])
    ].join(' ').toLowerCase();
    return hay.includes(q);
  }

  function apply() {
    const visible = [];
    for (let i = 0; i < state.docs.length; i++) if (matches(state.docs[i])) visible.push(i);
    state.visible = new Set(visible);
    renderList(visible);
    renderStats(visible.length);
    if (state.selected !== null && !state.visible.has(state.selected)) {
      state.selected = null;
      renderDetail();
    }
    draw();
  }

  function renderStats(n) {
    const m = state.data.meta;
    el('stats').textContent = '';
    const b1 = document.createElement('b');
    b1.textContent = n + '/' + m.documentos;
    const b2 = document.createElement('b');
    b2.textContent = m.relaciones;
    const b3 = document.createElement('b');
    b3.textContent = m.excluidos;
    el('stats').append(
      b1, document.createTextNode(' docs · '),
      b2, document.createTextNode(' relaciones · '),
      b3, document.createTextNode(' excluidos · ' + m.generado)
    );
  }

  function renderList(visible) {
    const list = el('list');
    list.textContent = '';
    el('list-count').textContent = visible.length + ' documentos';
    const frag = document.createDocumentFragment();
    const sorted = [...visible].sort((a, b) =>
      state.docs[b].grado - state.docs[a].grado || state.docs[a].title.localeCompare(state.docs[b].title));
    for (const i of sorted) {
      const d = state.docs[i];
      const li = document.createElement('li');
      li.dataset.i = i;
      if (state.selected === i) li.setAttribute('aria-current', 'true');
      const left = document.createElement('div');
      const t = document.createElement('div');
      t.className = 't';
      t.textContent = d.title;
      const p = document.createElement('div');
      p.className = 'p';
      p.textContent = d.area + ' · ' + d.file;
      left.append(t, p);
      const deg = document.createElement('span');
      deg.className = 'd';
      deg.textContent = d.grado;
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
      p.textContent = 'Selecciona un documento en el mapa o en la lista.';
      box.appendChild(p);
      return;
    }
    const d = state.docs[state.selected];
    const h2 = document.createElement('h2');
    h2.textContent = d.title;
    const path = document.createElement('div');
    path.className = 'path';
    path.textContent = d.file;

    const badges = document.createElement('div');
    badges.className = 'g-badges';
    const mk = (text, cls) => {
      const s = document.createElement('span');
      s.className = 'g-badge' + (cls ? ' ' + cls : '');
      s.textContent = text;
      badges.appendChild(s);
    };
    mk(d.area);
    if (d.tipo) mk(d.tipo);
    mk(ESTADOS.find((e) => e[0] === d.estado)[1], d.estado);
    mk(d.grado + ' vínculos');

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
    row('Owner', d.owner);
    row('Corte', d.corte);
    row('Revisar', d.revisar);
    row('Vigente', d.vigente_hasta);
    row('Capacidad', d.capacidad);
    row('Comunidad', d.comunidad_nombre);

    const actions = document.createElement('div');
    actions.className = 'g-actions';
    const ob = document.createElement('a');
    ob.className = 'primary';
    ob.href = d.obsidian;
    ob.textContent = 'Abrir en Obsidian';
    actions.appendChild(ob);
    const copy = document.createElement('a');
    copy.href = '#doc=' + state.selected;
    copy.textContent = 'Enlace a esta ficha';
    actions.appendChild(copy);

    const h3rels = document.createElement('h3');
    h3rels.textContent = 'Vinculados';
    const rels = document.createElement('ul');
    rels.className = 'g-rel';
    const neigh = state.adj[state.selected] || [];
    if (!neigh.length) {
      const li = document.createElement('li');
      li.textContent = 'Sin relaciones entre documentos.';
      rels.appendChild(li);
    }
    for (const n of neigh.slice(0, 24)) {
      const li = document.createElement('li');
      li.textContent = state.docs[n.i].title;
      const r = document.createElement('span');
      r.className = 'r';
      r.textContent = (n.dir === 'out' ? '→ ' : '← ') + n.rel;
      li.appendChild(r);
      li.addEventListener('click', () => select(n.i));
      rels.appendChild(li);
    }

    box.append(h2, path, badges, kv, actions);
    if (d.headings && d.headings.length) {
      const h3h = document.createElement('h3');
      h3h.textContent = 'Encabezados';
      const tags = document.createElement('div');
      tags.className = 'g-tags';
      for (const h of d.headings.slice(0, 18)) {
        const s = document.createElement('span');
        s.textContent = h;
        tags.appendChild(s);
      }
      box.append(h3h, tags);
    }
    box.append(h3rels, rels);
  }

  function select(i, push = true) {
    if (!Number.isInteger(i) || !state.docs[i]) return;
    state.selected = i;
    if (push) history.replaceState(null, '', '#doc=' + i);
    renderDetail();
    for (const li of el('list').children) {
      if (Number(li.dataset.i) === i) li.setAttribute('aria-current', 'true');
      else li.removeAttribute('aria-current');
    }
    draw();
  }

  /* ---------- layout ---------- */
  function layout() {
    const n = state.docs.length;
    const R = 320;
    state.pos = new Array(n);
    state.vel = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = R * (0.35 + 0.65 * ((i * 37) % 97) / 97);
      state.pos[i] = { x: Math.cos(a) * r, y: Math.sin(a) * r };
      state.vel[i] = { x: 0, y: 0 };
    }
    const K = 9000;
    const spring = 0.012;
    const damp = 0.82;
    for (let tick = 0; tick < 320; tick++) {
      const fx = new Float64Array(n);
      const fy = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = state.pos[i].x - state.pos[j].x;
          let dy = state.pos[i].y - state.pos[j].y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = (i - j) * 0.01 + 0.01; dy = 0.01; d2 = 1; }
          const f = K / d2;
          const d = Math.sqrt(d2);
          fx[i] += (dx / d) * f; fy[i] += (dy / d) * f;
          fx[j] -= (dx / d) * f; fy[j] -= (dy / d) * f;
        }
      }
      for (const [s, t] of state.edges) {
        const dx = state.pos[t].x - state.pos[s].x;
        const dy = state.pos[t].y - state.pos[s].y;
        const d = Math.hypot(dx, dy) || 1;
        const goal = 70;
        const f = (d - goal) * spring;
        fx[s] += (dx / d) * f; fy[s] += (dy / d) * f;
        fx[t] -= (dx / d) * f; fy[t] -= (dy / d) * f;
      }
      for (let i = 0; i < n; i++) {
        state.vel[i].x = (state.vel[i].x + fx[i]) * damp;
        state.vel[i].y = (state.vel[i].y + fy[i]) * damp;
        state.pos[i].x += state.vel[i].x;
        state.pos[i].y += state.vel[i].y;
      }
    }
  }

  /* ---------- dibujo ---------- */
  let raf = 0;
  function draw() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(paint);
  }

  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!state.pos.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of state.pos) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const pad = 40;
    const k = Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1));
    state.view.k = Math.max(0.25, Math.min(k, 2.2));
    state.view.x = w / 2 - ((minX + maxX) / 2) * state.view.k;
    state.view.y = h / 2 - ((minY + maxY) / 2) * state.view.k;
  }

  function toScreen(p) {
    return { x: p.x * state.view.k + state.view.x, y: p.y * state.view.k + state.view.y };
  }

  function paint() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (!state.painted) { fit(); state.painted = true; }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const k = state.view.k;
    ctx.lineWidth = 0.7;
    for (const [s, t] of state.edges) {
      const a = state.visible.has(s), b = state.visible.has(t);
      if (!a && !b) continue;
      const p1 = toScreen(state.pos[s]), p2 = toScreen(state.pos[t]);
      const hot = state.selected === s || state.selected === t;
      ctx.strokeStyle = hot ? 'rgba(222,209,22,.75)' : (a && b ? 'rgba(190,7,109,.30)' : 'rgba(120,90,105,.10)');
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }

    for (let i = 0; i < state.docs.length; i++) {
      const d = state.docs[i];
      const p = toScreen(state.pos[i]);
      const on = state.visible.has(i);
      const r = Math.max(3, Math.min(11, 3 + Math.sqrt(d.grado) * 1.3)) * Math.max(0.7, Math.min(k, 1.6));
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = on ? (AREA_COLOR[d.area] || '#c9a9b8') : 'rgba(120,90,105,.22)';
      ctx.globalAlpha = on ? 0.92 : 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (state.selected === i) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      } else if (state.hover === i) {
        ctx.strokeStyle = '#ded116'; ctx.lineWidth = 1.6; ctx.stroke();
      }
    }
  }

  /* ---------- interacción ---------- */
  function hit(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    let best = null, bestD = 14;
    for (let i = 0; i < state.docs.length; i++) {
      const p = toScreen(state.pos[i]);
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

    el('f-area').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-area]');
      if (!b) return;
      const a = b.dataset.area;
      state.areas.has(a) ? state.areas.delete(a) : state.areas.add(a);
      b.setAttribute('aria-pressed', String(state.areas.has(a)));
      apply();
    });
    el('f-estado').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-estado]');
      if (!b) return;
      const s = b.dataset.estado;
      state.estados.has(s) ? state.estados.delete(s) : state.estados.add(s);
      b.setAttribute('aria-pressed', String(state.estados.has(s)));
      apply();
    });
    el('f-tipo').addEventListener('change', (e) => { state.tipo = e.target.value; apply(); });
    el('f-com').addEventListener('change', (e) => { state.com = e.target.value; apply(); });
    el('reset').addEventListener('click', () => {
      state.q = ''; q.value = '';
      state.areas.clear(); state.estados.clear(); state.tipo = ''; state.com = '';
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
      const d = state.docs[i];
      tip.hidden = false;
      tip.textContent = d.title + ' · ' + d.area;
      const rect = canvas.getBoundingClientRect();
      tip.style.left = Math.min(e.clientX - rect.left + 12, rect.width - 220) + 'px';
      tip.style.top = Math.max(6, e.clientY - rect.top - 12) + 'px';
    });
    canvas.addEventListener('mouseleave', () => { tip.hidden = true; state.hover = null; draw(); });

    canvas.addEventListener('click', (e) => {
      const i = hit(e.clientX, e.clientY);
      if (i !== null) select(i);
    });

    // pan + zoom
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, vx: state.view.x, vy: state.view.y, moved: false };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      state.view.x = drag.vx + dx; state.view.y = drag.vy + dy;
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
      const k2 = Math.max(0.2, Math.min(5, state.view.k * (e.deltaY < 0 ? 1.12 : 0.89)));
      state.view.x = mx - (mx - state.view.x) * (k2 / state.view.k);
      state.view.y = my - (my - state.view.y) * (k2 / state.view.k);
      state.view.k = k2;
      draw();
    }, { passive: false });

    window.addEventListener('resize', () => { fit(); draw(); });
  }

  boot();
})();
