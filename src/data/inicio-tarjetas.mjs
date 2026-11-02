// Tarjetas del panel «Inicio» de la vista dividida (item 6 del encargo).
// Solo nombre canónico, estado y una nota corta: nunca cifras, nunca datos
// personales, nunca cuentas. Cada registro trae su fuente y su corte.
//
// Regla: si el estado no está escrito en la fuente, va «sin confirmar».
// El modelo de datos v5 (fase 2) will replace este archivo por los JSON de
// src/data/base/*.json; aquí queda la versión mínima que ya se puede usar.

export const FUENTE_CLIENTES = 'RR · 00_RUTAS.md y 20_Empresa/proyectos.md';
export const CORTE_CLIENTES = '2026-10-14';
export const FUENTE_SERVICIOS = 'RR · Manual de los bots de RR (oct 2026) y árbol del Atlas';
export const CORTE_SERVICIOS = '2026-10-24';

export const ESTADOS = {
  activo: { label: 'Activo', tone: 'ok' },
  'en construcción': { label: 'En construcción', tone: 'warn' },
  'en desarrollo': { label: 'En desarrollo', tone: 'warn' },
  pausado: { label: 'Pausado', tone: 'bad' },
  prospecto: { label: 'Prospecto', tone: 'info' },
  histórico: { label: 'Histórico', tone: 'info' },
  'sin confirmar': { label: 'Sin confirmar', tone: 'info' },
};

export const CLIENTES = [
  {
    id: 'candilejas-553',
    nombre: 'Candilejas + 553',
    estado: 'activo',
    nota: 'Proyecto multi-sede: pedidos, panel de cocina y meseros, NFC en mesas.',
    fuente: '20_Empresa/proyectos.md',
    corte: '2026-10-14',
  },
  {
    id: 'wundeer',
    nombre: 'Wundeer',
    estado: 'activo',
    nota: 'Desarrollo, contenido y pauta. Contrato pendiente de confirmar.',
    fuente: '20_Empresa/proyectos.md',
    corte: '2026-10-14',
  },
  {
    id: 'boga',
    nombre: 'BOGA',
    estado: 'sin confirmar',
    nota: 'Relación comercial registrada; estado sin confirmar.',
    fuente: '00_RUTAS.md',
    corte: '2026-09-26',
  },
  {
    id: 'imf-visions',
    nombre: 'IMF Visions',
    estado: 'sin confirmar',
    nota: 'Nombre canónico registrado en el inventario de rutas.',
    fuente: '00_RUTAS.md',
    corte: '2026-09-26',
  },
  {
    id: 'satiro-sushi',
    nombre: 'Satiro_Sushi',
    estado: 'pausado',
    nota: 'Relación pausada.',
    fuente: '00_RUTAS.md',
    corte: '2026-09-26',
  },
  {
    id: 'amsterdam',
    nombre: 'Amsterdam',
    estado: 'sin confirmar',
    nota: 'Nombre canónico registrado en el inventario de rutas.',
    fuente: '00_RUTAS.md',
    corte: '2026-09-26',
  },
  {
    id: 'zapatos-shoes',
    nombre: 'Zapatos / Shoes Colombia',
    estado: 'sin confirmar',
    nota: 'La relación misma está sin confirmar.',
    fuente: '00_RUTAS.md',
    corte: '2026-09-26',
  },
  {
    id: 'turismo-anheyca',
    nombre: 'Turismo Anheyca',
    estado: 'sin confirmar',
    nota: 'Relación sin documentar.',
    fuente: '00_RUTAS.md',
    corte: '2026-09-26',
  },
  {
    id: 'billares-charly-brown',
    nombre: 'Billares Charly Brown',
    estado: 'sin confirmar',
    nota: 'Relación sin confirmar.',
    fuente: '00_RUTAS.md',
    corte: '2026-09-26',
  },
  {
    id: 'siraitia',
    nombre: 'Siraitia',
    estado: 'histórico',
    nota: 'Cliente histórico; la relación ya no está activa.',
    fuente: '00_RUTAS.md',
    corte: '2026-09-26',
  },
  {
    id: 'alma-y-mente',
    nombre: 'Alma_y_Mente',
    estado: 'histórico',
    nota: 'Cliente histórico; la relación ya no está activa.',
    fuente: '00_RUTAS.md',
    corte: '2026-09-26',
  },
];

export const SERVICIOS = [
  {
    id: 'saas-ropa',
    nombre: 'SaaS Ropa',
    estado: 'en construcción',
    nota: 'Tienda online por suscripción para tiendas de ropa. Alcance y planes sin confirmar.',
    fuente: 'Manual de los bots de RR (oct 2026)',
    corte: '2026-10-24',
  },
  {
    id: 'saas-resto',
    nombre: 'SaaS Resto',
    estado: 'en construcción',
    nota: 'SaaS vertical para restaurantes, multi-sede. Alcance y planes sin confirmar.',
    fuente: 'Manual de los bots de RR (oct 2026)',
    corte: '2026-10-24',
  },
  {
    id: 'creadores',
    nombre: 'Creadores',
    estado: 'en construcción',
    nota: 'Infoproductos para creadores. Detalles sin confirmar.',
    fuente: 'Manual de los bots de RR (oct 2026)',
    corte: '2026-10-24',
  },
  {
    id: 'buen-puente',
    nombre: 'Buen Puente',
    estado: 'en desarrollo',
    nota: 'Producto interno tipo Airbnb; frontend en Railway.',
    fuente: '20_Empresa/proyectos.md',
    corte: '2026-10-14',
  },
  {
    id: 'desarrollo-a-medida',
    nombre: 'Desarrollo a la medida y servicios web',
    estado: 'activo',
    nota: 'Webs, productos digitales y pasarela de pago.',
    fuente: 'RR · 20_Empresa/identidad.md',
    corte: '2026-09-26',
  },
  {
    id: 'diagnostico-digital',
    nombre: 'Diagnóstico digital',
    estado: 'activo',
    nota: 'Revisión de marca, web, redes, SEO y GEO.',
    fuente: 'RR · 20_Empresa/identidad.md',
    corte: '2026-09-26',
  },
  {
    id: 'contenido-y-pauta',
    nombre: 'Contenido y pauta',
    estado: 'activo',
    nota: 'Video, grabaciones, modelos y pauta.',
    fuente: 'RR · 20_Empresa/identidad.md',
    corte: '2026-09-26',
  },
  {
    id: 'marca-y-redes',
    nombre: 'Marca y redes',
    estado: 'activo',
    nota: 'Estrategia, identidad, brand kit y calendario editorial.',
    fuente: 'RR · 20_Empresa/identidad.md',
    corte: '2026-09-26',
  },
  {
    id: 'otras-lineas',
    nombre: 'Otras líneas',
    estado: 'sin confirmar',
    nota: 'Líneas sin documentar todavía.',
    fuente: 'RR · Manual de los bots de RR (oct 2026)',
    corte: '2026-10-24',
  },
];
