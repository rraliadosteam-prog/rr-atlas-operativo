export const DEFAULT_GRAPH = {
  "data": [
    // GOBIERNO
    { "id": "gob_001", "title": "Politica de datos", "type": "Gobierno", "desc": "Manejo de informacion sensible y privacidad de clientes.", "x": 100, "y": 50, "links": [], "notes": "Actualizar trimestralmente. Revisar con abogada.", "owner": "Direccion", "status": "Documentado" },
    { "id": "gob_002", "title": "Modelo de negocio", "type": "Gobierno", "desc": "Canvas y propuesta de valor de RR Aliados.", "x": 350, "y": 50, "links": [], "notes": "Validado en Q3 2026.", "owner": "Direccion", "status": "Validado" },
    { "id": "gob_003", "title": "Gobierno documental", "type": "Gobierno", "desc": "Reglas de creacion, ubicacion y archivo de documentos.", "x": 600, "y": 50, "links": [], "notes": "157 documentos registrados. 25 canvas activos.", "owner": "Direccion", "status": "En curso" },

    // PROCESOS
    { "id": "proc_001", "title": "Playbook Comercial", "type": "Proceso", "desc": "Flujo completo desde prospecto hasta onboarding.", "x": 100, "y": 250, "links": [], "notes": "8 pasos documentados en BPMN. 50% de avance.", "owner": "Comercial", "status": "En curso" },
    { "id": "proc_002", "title": "Legal y contratos", "type": "Proceso", "desc": "Redaccion, revision y firma de contratos.", "x": 350, "y": 250, "links": [], "notes": "Plantillas en Drive. Firma via DocuSign o fisica.", "owner": "Legal externo", "status": "Activo" },
    { "id": "proc_003", "title": "Cobranza", "type": "Proceso", "desc": "Facturacion, seguimiento y conciliacion de pagos.", "x": 600, "y": 250, "links": [], "notes": "3 facturas vencidas. Runway: 3 meses.", "owner": "Direccion", "status": "Alerta" },
    { "id": "proc_004", "title": "Soporte y escalamiento", "type": "Proceso", "desc": "Atencion a clientes y resolucion de problemas.", "x": 850, "y": 250, "links": [], "notes": "Tickets via WhatsApp/Email. DashWeb para registro.", "owner": "Operaciones", "status": "Activo" },
    { "id": "proc_005", "title": "IA y automatizaciones", "type": "Proceso", "desc": "Identificar, documentar y desplegar automatizaciones.", "x": 1100, "y": 250, "links": [], "notes": "11 bots activos. NEXORA dashboard en desarrollo.", "owner": "Direccion", "status": "En curso" },

    // CLIENTES
    { "id": "cli_001", "title": "TechCorp SAS", "type": "Cliente", "desc": "Cliente tecnologico con proyectos de IA y automatizacion.", "x": 100, "y": 450, "links": [], "notes": "Contrato vigente. Proyecto de pipeline en curso.", "owner": "Comercial", "status": "Activo" },
    { "id": "cli_002", "title": "Fundacion Educa", "type": "Cliente", "desc": "Organizacion sin animo de lucro. Programa educativo.", "x": 350, "y": 450, "links": [], "notes": "Contrato anual renovado. Pagos al dia.", "owner": "Comercial", "status": "Activo" },
    { "id": "cli_003", "title": "Alcaldia Mayor", "type": "Cliente", "desc": "Contrato de servicios digitales y ciudadania.", "x": 600, "y": 450, "links": [], "notes": "Buen Puente como producto principal. PQR en espera.", "owner": "Direccion", "status": "Vigente" },
    { "id": "cli_004", "title": "Startup FinTech", "type": "Cliente", "desc": "Prospecto en negociacion. Interes en DashWeb CRM.", "x": 850, "y": 450, "links": [], "notes": "Propuesta enviada. Esperando respuesta.", "owner": "Comercial", "status": "Prospecto" },

    // PRODUCTOS
    { "id": "prod_001", "title": "DashWeb CRM", "type": "Producto propio", "desc": "Sistema de gestion de clientes y proyectos.", "x": 100, "y": 650, "links": [], "notes": "En produccion. Usado internamente y por clientes.", "owner": "Tech", "status": "Activo" },
    { "id": "prod_002", "title": "Buen Puente", "type": "Producto propio", "desc": "Plataforma de conexion ciudadana tipo Airbnb.", "x": 350, "y": 650, "links": [], "notes": "MVP en desarrollo. Login y perfil funcionando.", "owner": "Direccion", "status": "En desarrollo" },
    { "id": "prod_003", "title": "Sazon Alacena", "type": "Producto reutilizable", "desc": "Tienda digital para emprendedores de alimentos.", "x": 600, "y": 650, "links": [], "notes": "En produccion. Pagos e inventario activos.", "owner": "Operaciones", "status": "Activo" },
    { "id": "prod_004", "title": "Atlas Operativo", "type": "Producto propio", "desc": "Mapa visual interactivo de la empresa.", "x": 850, "y": 650, "links": [], "notes": "v4.2 en desarrollo. Vista Explorar agregada.", "owner": "Tech", "status": "En desarrollo" },

    // AREAS
    { "id": "area_001", "title": "Direccion", "type": "Area", "desc": "Toma de decisiones estrategicas y representacion.", "x": 100, "y": 850, "links": [], "notes": "Santiago Rosas, CEO. Decisiones finales.", "owner": "Santiago Rosas", "status": "Activo" },
    { "id": "area_002", "title": "Operaciones", "type": "Area", "desc": "Ejecucion, coordinacion y soporte al cliente.", "x": 350, "y": 850, "links": [], "notes": "Manuel Mesa, COO. Onboarding y soporte.", "owner": "Manuel Mesa", "status": "Activo" },
    { "id": "area_003", "title": "Tech", "type": "Area", "desc": "Desarrollo, infraestructura y automatizacion.", "x": 600, "y": 850, "links": [], "notes": "Martin Lopez, dev interno. Supabase + Vercel.", "owner": "Martin Lopez", "status": "Activo" },

    // TALENTO
    { "id": "tal_001", "title": "Santiago Rosas", "type": "Talento", "desc": "CEO y fundador de RR Aliados.", "x": 100, "y": 1050, "links": [], "notes": "Direccion, vision y relaciones clave.", "owner": "Direccion", "status": "Activo" },
    { "id": "tal_002", "title": "Manuel Mesa", "type": "Talento", "desc": "COO y orquestador operativo.", "x": 350, "y": 1050, "links": [], "notes": "Operaciones, onboarding y coordinacion.", "owner": "Operaciones", "status": "Activo" },
    { "id": "tal_003", "title": "Martin Lopez", "type": "Talento", "desc": "Desarrollador interno en internship.", "x": 600, "y": 1050, "links": [], "notes": "Semana 3 de 12. Stack: React, Supabase, Node.", "owner": "Tech", "status": "Internship" },
    { "id": "tal_004", "title": "Isabela Morales", "type": "Talento", "desc": "Colaboradora externa. Diseno y comunicaciones.", "x": 850, "y": 1050, "links": [], "notes": "Freelance. Entregas visuales y contenido.", "owner": "Externo", "status": "Activo" },

    // HERRAMIENTAS
    { "id": "tool_001", "title": "Supabase", "type": "Herramienta", "desc": "Base de datos PostgreSQL, auth y storage.", "x": 100, "y": 1250, "links": [], "notes": "Backend principal. Sync con DashWeb.", "owner": "Tech", "status": "Activo" },
    { "id": "tool_002", "title": "DashWeb", "type": "Herramienta", "desc": "CRM propio de RR Aliados.", "x": 350, "y": 1250, "links": [], "notes": "Gestiona tareas, clientes y cobranza.", "owner": "Operaciones", "status": "Activo" },
    { "id": "tool_003", "title": "Obsidian", "type": "Herramienta", "desc": "Vault de conocimiento y documentacion.", "x": 600, "y": 1250, "links": [], "notes": "Second Brain RR. 157 documentos.", "owner": "Direccion", "status": "Activo" },
    { "id": "tool_004", "title": "NEXORA", "type": "Herramienta", "desc": "Dashboard de flota de bots.", "x": 850, "y": 1250, "links": [], "notes": "11 perfiles adoptados. Misiones y tracking.", "owner": "Tech", "status": "En desarrollo" },

    // CONTROLES
    { "id": "ctrl_001", "title": "Control de calidad", "type": "Control", "desc": "Revision de entregables antes de envio.", "x": 1100, "y": 450, "links": [], "notes": "Checklist por tipo de entrega.", "owner": "Operaciones", "status": "Activo" },
    { "id": "ctrl_002", "title": "Seguridad de datos", "type": "Control", "desc": "Cifrado, backups y accesos.", "x": 1100, "y": 650, "links": [], "notes": "Backups automaticos. Acceso por roles.", "owner": "Tech", "status": "Activo" }
  ],
  "lines": [
    // Gobierno conecta con todos
    ["gob_001", "proc_001"], ["gob_001", "proc_002"], ["gob_001", "proc_003"],
    ["gob_002", "area_001"], ["gob_002", "area_002"], ["gob_002", "area_003"],
    ["gob_003", "tool_003"],

    // Procesos conectan con clientes y productos
    ["proc_001", "cli_001"], ["proc_001", "cli_002"], ["proc_001", "cli_004"],
    ["proc_002", "cli_003"],
    ["proc_003", "cli_001"], ["proc_003", "cli_002"],
    ["proc_004", "cli_001"], ["proc_004", "cli_002"], ["proc_004", "cli_003"],
    ["proc_005", "tool_004"],

    // Clientes usan productos
    ["cli_001", "prod_001"], ["cli_001", "prod_004"],
    ["cli_002", "prod_003"],
    ["cli_003", "prod_002"],
    ["cli_004", "prod_001"],

    // Productos desarrollados por areas
    ["prod_001", "area_003"], ["prod_002", "area_003"], ["prod_003", "area_002"], ["prod_004", "area_003"],

    // Areas tienen talento
    ["area_001", "tal_001"],
    ["area_002", "tal_002"],
    ["area_003", "tal_003"],

    // Talento usa herramientas
    ["tal_001", "tool_003"], ["tal_001", "tool_004"],
    ["tal_002", "tool_002"],
    ["tal_003", "tool_001"], ["tal_003", "tool_004"],

    // Controles aplican a procesos
    ["ctrl_001", "proc_001"], ["ctrl_001", "proc_004"],
    ["ctrl_002", "tool_001"], ["ctrl_002", "tool_002"]
  ]
};
