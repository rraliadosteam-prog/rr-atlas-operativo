// Corte manual del 17-nov-2026 para la portada «Hoy» del Atlas.
// Regla de honestidad: todo lo que sale de aquí se muestra con la etiqueta
// del corte; no es en vivo. Se reemplaza cuando haya una fuente única
// (tabla de clientes y desarrollos en Supabase).
// Versión pública: clientes con etiqueta genérica; los nombres reales no se publican.
export const CORTE = {
  etiqueta: 'Corte manual del 17-nov, 2:06 a. m. · no es en vivo',
  clientes: [
    { nombre: 'Cliente B', estado: 'activo' },
    { nombre: 'Cliente A', estado: 'activo' },
    { nombre: 'Cliente C', estado: 'activo' },
    { nombre: 'Cliente D', estado: 'activo' },
    { nombre: 'Cliente E', estado: 'activo' },
    { nombre: 'Cliente F', estado: 'activo' },
    { nombre: 'Cliente G', estado: 'activo' },
    { nombre: 'Cliente H', estado: 'prospecto' },
    { nombre: 'Cliente I', estado: 'entregado' },
    { nombre: 'Cliente J', estado: 'pausado' },
    { nombre: 'Cliente K', estado: 'pausado' },
    { nombre: 'Cliente L', estado: 'ex-cliente' },
    { nombre: 'Cliente M', estado: 'ex-cliente' },
  ],
  // semaforo: verde = código guardado y en línea; mostaza = versión nueva esperando visto bueno; rojo = sin código guardado o no encontrado.
  desarrollos: [
    { nombre: 'Atlas', semaforo: 'mostaza', estado: 'Versión nueva esperando tu visto bueno', enlace: 'https://github.com/rraliadosteam-prog/rr-atlas-operativo/pull/11' },
    { nombre: 'RR Tareas', semaforo: 'mostaza', estado: 'Versión nueva esperando tu visto bueno', enlace: 'https://github.com/rraliadosteam-prog/rr-tareas/pull/4' },
    { nombre: 'Mega Dashboard / Centro de Mando', semaforo: 'rojo', estado: 'GitHub no encuentra su código' },
    { nombre: 'Content Hub', semaforo: 'rojo', estado: 'Sin código guardado en GitHub' },
    { nombre: 'Entregas', semaforo: 'rojo', estado: 'Sin código guardado en GitHub' },
    { nombre: 'DashWeb', semaforo: 'rojo', estado: 'Sin código guardado en GitHub' },
    { nombre: 'Postiz', semaforo: 'rojo', estado: 'Sin código guardado en GitHub' },
    { nombre: 'Bots (Hermes)', semaforo: 'rojo', estado: 'Sin código guardado en GitHub' },
    { nombre: 'Medellín Guía', semaforo: 'rojo', estado: 'En línea, pero sin código guardado' },
  ],
};

export const ESTADOS_CLIENTE = [
  ['activo', 'Activos'],
  ['prospecto', 'Prospectos'],
  ['entregado', 'Entregados'],
  ['pausado', 'Pausados'],
  ['ex-cliente', 'Ex clientes'],
];
