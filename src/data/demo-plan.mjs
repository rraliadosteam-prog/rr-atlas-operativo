const PLAN_KEY = 'rr-atlas-plan-v1';

const SEED = [
  { id: 'task_01', date: 'Octubre 2026', area: 'Producto', title: 'Atlas Operativo v4 — vista Explorar con datos reales', criteria: 'Grid de tarjetas con datos del grafo, no fixtures. Panel de detalle funcional.', status: 'En curso', note: 'Pendiente conectar DEFAULT_GRAPH a la vista Explorar' },
  { id: 'task_02', date: 'Octubre 2026', area: 'Producto', title: 'Buen Puente — MVP ciudadano funcional', criteria: 'Login, perfil, solicitudes y panel de administracion operativo.', status: 'En curso', note: 'En desarrollo interno' },
  { id: 'task_03', date: 'Octubre 2026', area: 'Finanzas', title: 'Cobranza Q4 — conciliar cartera vencida', criteria: 'Todos los clientes con facturas >30 dias tienen plan de pago o acuerdo.', status: 'En curso', note: 'Seguimiento semanal en Excel' },
  { id: 'task_04', date: 'Noviembre 2026', area: 'Procesos', title: 'Documentar 10 flujos operativos en BPMN', criteria: 'Cada flujo tiene diagrama, RACI, checklist y responsable asignado.', status: 'En curso', note: '5 de 10 completados' },
  { id: 'task_05', date: 'Noviembre 2026', area: 'Tech', title: 'Migrar DashWeb a Supabase stable', criteria: 'Sin errores de conexion, sync automatico de tareas y usuarios.', status: 'Pendiente', note: 'Esperando validacion de schema' },
  { id: 'task_06', date: 'Noviembre 2026', area: 'Gobierno', title: 'Auditoria de documentacion Vault — Q4', criteria: 'Todos los _CONTEXTO.md actualizados, sin duplicados, indices al dia.', status: 'Pendiente', note: 'Revisar 157 documentos' },
  { id: 'task_07', date: 'Diciembre 2026', area: 'Entrega', title: 'Sazon Alacena — lanzamiento tienda', criteria: 'Tienda online con pagos, inventario y panel de administrador.', status: 'Pendiente', note: 'Depende de definir modelo de comisiones' },
  { id: 'task_08', date: 'Diciembre 2026', area: 'Experiencia', title: 'NEXORA — dashboard de flota estable', criteria: 'Todos los bots reportando estado, misiones trackeables, alertas por WhatsApp.', status: 'En curso', note: '11 perfiles adoptados, falta automatizar reportes' },
  { id: 'task_09', date: 'Enero 2027', area: 'Talento', title: 'Onboarding Martin (internship) — plan de 90 dias', criteria: 'Roadmap claro de aprendizaje, mentor asignado, PRs en produccion.', status: 'En curso', note: 'Semana 3 de 12' },
  { id: 'task_10', date: 'Enero 2027', area: 'Producto', title: 'Content Hub — hub interno + externo unificado', criteria: 'Un solo CMS para contenido de RR, clientes y ciudadanos.', status: 'Pendiente', note: 'En fase de definicion de arquitectura' },
];

const clone = (value) => JSON.parse(JSON.stringify(value));

function loadTasks(storage) {
  try {
    const raw = storage.getItem(PLAN_KEY);
    if (!raw) return clone(SEED);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : clone(SEED);
  } catch {
    return clone(SEED);
  }
}

export function createPlanView({ app, onToast }) {
  const section = app.querySelector('[data-atlas-plan]');
  const list = section.querySelector('[data-atlas-plan-list]');
  const storage = window.localStorage;
  let tasks = loadTasks(storage);
  let filter = 'Todo';

  const save = () => storage.setItem(PLAN_KEY, JSON.stringify(tasks));
  const update = (id, patch) => {
    tasks = tasks.map((task) => task.id === id ? { ...task, ...patch } : task);
    save();
  };

  const render = () => {
    list.replaceChildren();
    const visible = tasks.filter((task) => filter === 'Todo' || task.status === filter);
    const groups = new Map();
    for (const task of visible) groups.set(task.date, [...(groups.get(task.date) ?? []), task]);
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'atlas-plan-empty atlas-muted';
      empty.textContent = 'No hay tareas con este estado en el fixture local.';
      list.append(empty);
      return;
    }
    for (const [date, group] of groups) {
      const groupEl = document.createElement('section');
      groupEl.className = 'atlas-plan-group';
      const heading = document.createElement('h2');
      heading.textContent = date;
      groupEl.appendChild(heading);
      const grid = document.createElement('div');
      grid.className = 'atlas-plan-grid';
      for (const task of group) {
        const card = document.createElement('article');
        card.className = 'atlas-plan-card mat-panel';
        const meta = document.createElement('div');
        meta.className = 'atlas-plan-card-meta';
        const area = document.createElement('span');
        area.className = 'kind';
        area.textContent = task.area;
        const state = document.createElement('span');
        state.className = `atlas-plan-state atlas-plan-state--${task.status.toLowerCase().replaceAll(' ', '-')}`;
        state.textContent = task.status;
        meta.append(area, state);
        const title = document.createElement('h3');
        title.textContent = task.title;
        const criteria = document.createElement('p');
        criteria.className = 'atlas-muted';
        criteria.textContent = `Listo cuando: ${task.criteria}`;
        const status = document.createElement('select');
        for (const optionValue of ['Pendiente', 'En curso', 'Hecho', 'Bloqueada']) {
          const option = document.createElement('option');
          option.value = optionValue;
          option.textContent = optionValue;
          option.selected = task.status === optionValue;
          status.appendChild(option);
        }
        status.setAttribute('aria-label', `Estado de ${task.title}`);
        status.addEventListener('change', () => {
          update(task.id, { status: status.value });
          render();
          onToast?.(`Estado actualizado: ${status.value}`);
        });
        const note = document.createElement('textarea');
        note.value = task.note || '';
        note.placeholder = 'Nota local de esta tarea';
        note.setAttribute('aria-label', `Nota de ${task.title}`);
        note.addEventListener('change', () => {
          update(task.id, { note: note.value.trim() });
          onToast?.('Nota local guardada');
        });
        card.append(meta, title, criteria, status, note);
        grid.appendChild(card);
      }
      groupEl.appendChild(grid);
      list.appendChild(groupEl);
    }
  };

  section.querySelectorAll('[data-plan-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      filter = button.dataset.planFilter;
      section.querySelectorAll('[data-plan-filter]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      render();
    });
  });

  return Object.freeze({
    activate() { render(); },
    render,
  });
}
