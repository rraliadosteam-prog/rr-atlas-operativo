# Atlas UX Hierarchy and Professional Polish Implementation Plan

> Ejecucion directa autorizada por Direccion sobre la rama de trabajo; no toca `main` ni produccion.

**Objetivo:** Mejorar la jerarquia visual, la agilidad de uso y la consistencia profesional del Atlas sin romper sus capacidades actuales.

**Arquitectura:** Se conserva el front JavaScript modular activo. La pasada se concentra en el shell semantico, tokens, layout, componentes y eventos; Rust queda fuera de esta iteracion visual porque su pantalla actual no tiene paridad funcional.

**Fuentes:** `design/PRODUCT.md`, `design/DESIGN.md`, `docs/AUDITORIA_RR_ATLAS.md` y la implementacion actual en `index.html`, `src/ui/` y `src/styles/`.

## Alcance

- Hacer evidente la ruta primaria: explorar, seleccionar, editar.
- Separar acciones primarias, secundarias y de apoyo.
- Reducir ruido del header y del toolbar sin esconder busqueda ni controles frecuentes.
- Corregir layout movil, panel editor y overlays.
- Mejorar estados de foco, hover, activo, vacio y error.
- Mantener la identidad B.U.C.M. y el funcionamiento actual.
- Verificar escritorio, tablet y movil en navegador real.

## Riesgos que se deben comprobar

- La busqueda y la configuracion no pueden perderse en movil.
- El panel editor no puede tapar el lienzo sin forma clara de cerrarlo.
- El minimapa y el estado no pueden competir con la seleccion activa.
- Los botones iconicos deben conservar nombre accesible y objetivo tactil.
- El cambio visual no puede activar por accidente el build Rust incompleto.

## Verificacion

- `npm test`.
- `npm run build:legacy`.
- Detector mecanico de Impeccable sobre los archivos UI modificados.
- Navegador real en 1440, 1024, 768 y 390 px.
- Sin overflow horizontal.
- Sin errores de consola.
- Busqueda, filtro, seleccion, edicion, configuracion, minimapa y cierre del editor.
