# Preguntas pendientes — Fusión Atlas RR

Formato: `TODO(Rosas): ...`

- TODO(Rosas): Confirmar tipografía oficial: ¿se mantiene Inter Tight + Lexend o el brand kit usa Neue Haas Grotesk / Graphie? (marcado como «sin confirmar»).
- TODO(Rosas): ¿Se conserva la vista "Mapa vivo" jerárquica de B como landing principal o se quiere la vista "Inicio" con tarjetas de A como entrada?
- TODO(Rosas): ¿Cuál es el hub RR al que apunta "Volver al hub RR"? En B está `http://localhost:8081/`; en producción necesita URL real.
- TODO(Rosas): Estado de los bots extra del árbol de B (Buen Puente, Media Manager, Gains, Becas y Exposición): ¿pertenecen a la flota vigente o quedan como "sin confirmar"?
- TODO(Rosas): Vigencia de la flota Hermes documentada en `20_Empresa/flota_ia.md` (corte 2026-09-26): ¿histórica o aún vigente parcialmente?
- TODO(Rosas): Confirmar lista canónica de clientes y estados: Wundeer, BOGA, Candilejas + 553, IMF Visions, Satiro_Sushi, Amsterdam, Zapatos/Shoes Colombia, Turismo Anheyca, Billares Charly Brown, Siraitia, Alma_y_Mente.
- TODO(Rosas): ¿Quién puede tener cuenta de cobro en RR? (colaborador vs contrato vs otros).
- TODO(Rosas): ¿Existen datos públicos de contacto personal del equipo (correo/teléfono) que sí se puedan mostrar, o se mantiene solo nombre + rol?
- TODO(Rosas): ¿Se incluyen cifras agregadas no financieras en "Mensaje ejecutivo diario" (por ejemplo, número de tareas bloqueadas) o se deja solo como flujo sin datos?
- TODO(Rosas): El prompt habla de 17 semillas BPMN, pero A trae 16 archivos en `src/bpmn/seeds/` (y `scripts/validate-bpmn.mjs` exige 16). ¿Falta una semilla por modelar o la cuenta del prompt está desactualizada?
- TODO(Rosas): Ninguna de las 16 semillas pasa el lint sin avisos (8 tienen la deuda documentada `no-gateway-join-fork`). ¿Se repara el modelado de esas compuertas (fase 5) o se acepta la deuda visible en la app?
- TODO(Rosas): En móvil (≤760px) el acceso a BPMN queda oculto hasta que exista la tabbar de la fase 6. ¿Se aprueba esa espera o el enlace debe quedar visible en la barra superior?

## Abiertas por la auditoría UX/UI (2026-11-02, bloque 2)

- TODO(Rosas): El diagrama BPMN hoy no se puede abrir en tablet (768 px) ni en móvil (360 px) porque el lienzo queda con 0 px de alto. ¿Se aprueba que el catálogo BPMN solo exista en escritorio hasta la fase de responsive, o el diagrama debe abrir en todas las pantallas (modo pantalla completa)?
- TODO(Rosas): En 768 px la barra superior se sale de la pantalla (el botón «Añadir nodo» queda a 103 px del borde). ¿Se compactan los botones de la barra o «Añadir nodo» pasa al panel lateral?
- TODO(Rosas): En tablet el nodo del mapa queda en 23×12 px y en móvil los botones del nodo en 31×31 px. ¿Se sube el tamaño mínimo de tarjeta o se deja el mapa pensado solo para zoom con ratón?
- TODO(Rosas): En el mapa, una búsqueda sin resultados deja el lienzo vacío sin aviso. ¿Se muestra un estado vacío («no encontramos ese nodo») o basta con el aviso al pulsar Enter?
- TODO(Rosas): Las 16 semillas BPMN siguen marcadas como «borrador» o «con deuda» porque ninguna pasa el lint sin avisos. ¿Se reparan en la fase 5 o se acepta la deuda visible en la app?

## Resueltas por Rosas (2026-11-02 17:01)
- RESUELTO: título «RR Aliados · Atlas operativo» (aplicado en el bloque 4: `<title>`, `meta description` y encabezado).
- RESUELTO: tipografía Inter Tight + Lexend.
- RESUELTO: página de entrada = Mapa vivo.
- RESUELTO: «Volver al hub» oculto hasta que exista la URL real.
- Nota: a Rosas le gusta el look actual del preview; conservarlo.

## Abiertas por el bloque 4 (2026-11-02, item 4)
- TODO(Rosas): La ficha de cada diagrama (qué busca, disparador, resultado y el camino paso a paso) sale del guion de procesos del mega prompt §6. ¿Se revisa esa redacción o se deja como texto de lectura provisional hasta que el equipo la valide?
- TODO(Rosas): La leyenda de colores dice qué significa cada color RR (crema = paso normal, fucsia = se traba, mostaza = atención, orquídea = carriles, gris = datos). ¿Es la convención que quiere la marca o se cambia?
- TODO(Rosas): La guía se abre en un panel a la derecha en escritorio y debajo del diagrama en móvil. ¿Se deja así o en escritorio también va como cajón superpuesto?

## Abiertas por el bloque 5 (2026-11-02, item 5)
- TODO(Rosas): En pantalla completa el diagrama tapa la cabecera del shell (marca RR, búsqueda y «Guía»). Se dejó la marca «RR» dentro de la propia vista BPMN. ¿Se mantiene así o se prefiere que la cabecera del shell siga visible encima del diagrama?
- TODO(Rosas): El botón «☰ Procesos» devuelve al catálogo y el proceso abierto se conserva. Al volver al catálogo la vista queda partida (catálogo + un diagrama vacío). ¿Se prefiere que el catálogo sea una pantalla completa propia (sin diagrama al lado) hasta que exista la pantalla dividida del item 6?
- TODO(Rosas): Al abrir un BPMN el diagrama entra siempre en pantalla completa. ¿Se deja así, o se recuerda la preferencia (pantalla completa o partida) entre sesiones?
- TODO(Rosas): En móvil la barra de controles del diagrama es una fila deslizable. ¿Se acepta el deslizamiento o se prefiere un botón «⋯» que abra un menú con las acciones menos usadas (exportar, restaurar, deshacer)?

## Abiertas por el bloque 6 (2026-11-02, item 6)
- TODO(Rosas): El panel «Inicio» de la pantalla dividida muestra 11 clientes y 9 servicios (líneas de negocio) con su estado. Los estados salen del inventario de RR y los que no tienen estado escrito en la fuente quedaron como «Sin confirmar» (BOGA, IMF Visions, Amsterdam, Zapatos/Shoes Colombia, Turismo Anheyca, Billares Charly Brown, «Otras líneas»). ¿Se corrigen esos estados o se deja «Sin confirmar» hasta que el modelo v5 los traiga del inventario oficial?
- TODO(Rosas): En la pestaña «Otro diagrama» el proceso de al lado es de solo lectura (no se edita). ¿Se deja así o el panel de al lado también debe permitir editar?
- TODO(Rosas): La pantalla dividida no se recuerda entre sesiones: al abrir un BPMN arranca siempre en pantalla completa (item 5) y la división se activa con «▥ Dividir» o la tecla D. ¿Se recuerda la preferencia?
