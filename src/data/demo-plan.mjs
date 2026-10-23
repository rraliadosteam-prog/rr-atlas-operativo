const PLAN_KEY = 'rr-atlas-plan-v1';

const SEED = [
  { id: 'task_01', date: 'Fecha por decidir', area: 'Producto', title: 'Definir el primer fragmento exportable', criteria: 'La vista actual puede exportarse sin tocar el mapa completo.', status: 'Pendiente', note: '' },
  { id: 'task_02', date: 'Fecha por decidir', area: 'Procesos', title: 'Revisar la validación BPMN antes de sincronizar', criteria: 'Los errores y avisos siguen visibles y explicados.', status: 'En curso', note: '' },
  { id: 'task_03', date: 'Fecha por decidir', area: 'Experiencia', title: 'Probar comentarios y notas del mapa', criteria: 'Una persona puede crear, editar y quitar un comentario local.', status: 'Pendiente', note: '' },
  { id: 'task_04', date: 'Fecha por decidir', area: 'Assets', title: 'Ordenar la biblioteca visual del Atlas', criteria: 'Los recursos tienen nombre, tipo, fuente y estado local.', status: 'Pendiente', note: '' },
  { id: 'task_05', date: 'Fecha por decidir', area: 'Entrega', title: 'Sincronizar datos reales solo después de aprobar la estructura', criteria: 'No hay fixtures de ejemplo mezclados con información real.', status: 'Pendiente', note: '' },
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
