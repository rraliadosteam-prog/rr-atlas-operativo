# Atlas tree prototype — cycle 1

Owner: Atlas. Scope: public-safe local/preview prototype only; no production publish, main merge, or main push.

## Specs

- S1: `BUGS a arreglar: (a) en movil no se alcanza el panel del proceso; (b) el boton de busqueda de la cabecera no hace nada; (c) 25 errores CSP por handlers onerror en linea (pasarlos a addEventListener) y 3 errores 404 en /api/estado (quitar la llamada o manejarla); (d) pestanas iframe a /grafo/, /bpmn/ y /flujos/ que dan 404; (e) objetivos tactiles menores de 44 px; (f) mezcla de voseo y tuteo (usar tuteo) y 'Procesos' frente a 'Flujos' (unificar en 'Procesos'); (g) filas mas anchas que la pantalla en movil.`
- S2: `NUEVO DISENO: reemplazar el mapa de izquierda a derecha por un ARBOL de arriba hacia abajo. Raiz: 'RR Labs'. Debajo: lineas de negocio (SaaS ropa, SaaS restaurantes, Buen Puente, Creadores, desarrollo a la medida, contenido y pauta, y otras lineas) -> sus funcionalidades y etapas (captacion, venta, entrega, cobro, soporte) -> procesos (con estado BPMN) -> proyectos y bots responsables, todo enlazado (enlaces cruzados visibles, por ejemplo bot <-> procesos que atiende).`
- S3: `EDITOR: arrastrar cuadros; agregar, editar y borrar cuadros y enlaces; deshacer; que se guarde (localStorage + exportar/importar JSON). Zoom, encuadrar, minimapa y busqueda que salte al nodo.`
- S4: `UI de nivel profesional con la marca RR: fucsia #be076d, mostaza #ded116, orquidea #973d8f, negro #070001, crema #fffff3; titulos Inter Tight y cuerpo Lexend (cargarlas de verdad); usar la skill Impecable si la tienes y microinteracciones tipo interior.dev en JS vanilla. Responsive movil con hoja inferior.`
- S5: `REGLAS: nada de contrasenas, tokens, cedulas, datos bancarios ni salarios en el mapa, el codigo ni el registro. NO publicar en produccion, NO cambiar la configuracion del proyecto de Vercel, NO hacer merge ni push a main. Solo version de prueba: rama nueva atlas-arbol-pro en el fork DEADKISS0/rr-atlas-operativo (push solo de esa rama) y, si se puede, un deploy de PREVIEW (vercel sin --prod), que queda tras Vercel Authentication.`
- S6: `Validar: npm run check y prueba en navegador headless a 390 px y 1440 px.`
- S7: `ENTREGA: escribe ~/rr-encargos/atlas-pro-20261030/entrega-ciclo1.md con la lista de lo arreglado y lo agregado, URL de preview o ruta local, 2 capturas (movil-390.png y escritorio-1440.png) en la carpeta, pendientes y ruta del respaldo. Termina imprimiendo ese mismo resumen.`

## Tasks

- T1 — S5/S7 — Back up production and repository; write log — commit: evidence only
- T2 — S1/S5 — Create the test branch and repair shell/navigation/responsive behavior — route: inline — commit: fdda425
- T3 — S2/S3 — Implement the top-down RR tree and local editor — route: inline — commit: fdda425
- T4 — S4/S6 — Apply RR visual system, mobile bottom sheet, and browser checks — route: inline — commit: fdda425
- T5 — S6/S7 — Run checks, capture screenshots, and prepare delivery note — route: inline — commit: 990d5cc + evidence outside repo

## Log

- L1: `Encargo de Rosas (RR ALIADOS), ciclo 1 de 2, coordinado por Atlas. Trabaja de forma autonoma y no interactiva; maximo ~35 minutos.`
- L2: Backup completed before source edits. The requested repository path and expected branch were not aligned with the available checkout; exact `645fa62` was archived from `/home/deadkiss/atlas-deploy-r31` and the current checkout was separately bundled.
- L3: Implementation committed as `fdda425` (tree/editor) and `990d5cc` (build checks and ODD tracking). `npm run check` and Chrome headless evidence passed. Fork push remains blocked by host interactive-confirmation policy in this noninteractive run.
