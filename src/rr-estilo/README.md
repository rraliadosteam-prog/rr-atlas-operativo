# RR Estilo

Sistema de diseño único de RR ALIADOS. Empaqueta tokens, componentes, fuentes y logos para que cada proyecto pueda vendorizarlos y construir de forma autónoma.

## Qué incluye

```text
.
├── tokens.css        # Variables CSS: colores, tipografía, espaciado, sombras, animaciones, breakpoints
├── componentes.css   # Clases reutilizables: botón, tarjeta, insignia, header, nav, footer, rejilla, logo
├── fonts/            # Inter Tight y Lexend (locales, sin CDN)
├── logos/            # Logos RR
├── demo.html         # Muestra de todos los tokens y componentes (incluye tarjeta con miniatura)
├── PLAN-DEPLOY.md    # Propuesta única de despliegue (pendiente de aprobación)
├── scripts/sync.sh   # Vendoriza rr-estilo en <proyecto>/src/rr-estilo/
└── README.md         # Este archivo
```

## Cómo usarlo

Desde un proyecto que ya tenga `rr-estilo` vendorizado:

```html
<link rel="stylesheet" href="src/rr-estilo/tokens.css" />
<link rel="stylesheet" href="src/rr-estilo/componentes.css" />
```

```html
<button class="rr-btn rr-btn--primary">Acción</button>
<article class="rr-card">…</article>
```

## Cómo sincronizar

Desde la raíz de `rr-estilo`:

```bash
./scripts/sync.sh /ruta/al/proyecto
```

Esto copia la versión actual a:

```text
/ruta/al/proyecto/src/rr-estilo/
```

Y genera dos archivos de control:

- `VERSION` — timestamp de la sincronización.
- `md5` — hashes de todos los archivos copiados.

El script es idempotente: limpia la versión anterior antes de copiar.

## Cómo ver el demo

```bash
cd ~/rr-estilo
python3 -m http.server 8082
```

Abrir: `http://localhost:8082/demo.html`

## Convenciones

- **Colores**: fucsia `#be076d`, mostaza `#ded116`, orquídea `#973d8f`, negro `#070001`, crema `#fffff3`.
- **Tipografía**: Inter Tight para títulos, Lexend para texto.
- **Esquinas**: cuadradas (`--radius-0` por defecto); brutalista.
- **Animaciones**: activas por defecto, anuladas por `prefers-reduced-motion`.
- **Layout**: móvil primero, breakpoints a 640, 1024 y 1280 px.

## Créditos

Dirección visual: Marca RR.  
Solicitante: Rosas.  
RR ALIADOS S.A.S.
