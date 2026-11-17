// Corte manual del 17-nov-2026 para la portada «Hoy» del Atlas.
// Regla de honestidad: todo lo que sale de aquí se muestra con la etiqueta
// del corte; no es en vivo. Se reemplaza cuando haya una fuente única
// (tabla de clientes y desarrollos en Supabase).
export const CORTE = {
  etiqueta: 'Corte manual del 17-nov, 2:06 a. m. · no es en vivo',
  clientes: [
    { nombre: '553', estado: 'activo' },
    { nombre: 'Candilejas', estado: 'activo' },
    { nombre: 'IMF Visions', estado: 'activo' },
    { nombre: 'Masmarcas', estado: 'activo' },
    { nombre: 'Pesquera', estado: 'activo' },
    { nombre: 'Wundeer', estado: 'activo' },
    { nombre: 'Zapatos', estado: 'activo' },
    { nombre: 'Amsterdam', estado: 'prospecto' },
    { nombre: 'BOGA', estado: 'entregado' },
    { nombre: 'Satiro', estado: 'pausado' },
    { nombre: 'Anheyca', estado: 'pausado' },
    { nombre: 'Alma y Mente', estado: 'ex-cliente' },
    { nombre: 'Siraitia', estado: 'ex-cliente' },
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
