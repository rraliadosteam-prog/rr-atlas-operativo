# Puerta de verificación del Atlas

Se corre **antes de cada entrega** (cada PR que se le muestre a Rosas). Produce un
reporte visual, sin código, con un semáforo por punto y capturas.

```bash
npm ci
npm run puerta            # sale con código 1 si algún punto queda en rojo
npm run puerta -- --no-bloquear   # genera el reporte sin cortar el proceso
```

Salida: `puerta-salida/<fecha>/reporte.html` (ignorado por Git), con `capturas/` y
`resultado.json`. Abre `reporte.html` en cualquier navegador.

Requisitos: Node 22+, Chrome (`/usr/bin/google-chrome` o la ruta en `CHROME_BIN`) y red
para bajar `typescript` con `npx` la primera vez. Variables opcionales:
`PUERTA_SALIDA` (carpeta de salida), `PUERTA_MAX_BOTONES` (por pantalla, 14 por defecto),
`PUERTA_TS_VERSION` (5.9.3 por defecto).

## Los cuatro puntos y cómo se colorean

| Punto | Qué mira | Verde | Amarillo | Rojo |
|---|---|---|---|---|
| a. Estructura | `npm run build`, `npm test`, `node --check` de todos los `.mjs` y `tsc --checkJs` | todo pasa y tsc no tiene fallos reales | tsc no pudo correr | falla el build, una prueba, la sintaxis o tsc encuentra un fallo real |
| b. Flujo | Clic o toque real (Playwright + Chrome) en cada botón visible de Mapa, Procesos, un proceso y Datos, a 390, 768 y 1440 px; cada clic en una ventana nueva | todos responden | algún botón no responde o no se deja pulsar | un clic produce un error de la app o falla más del 10 % |
| c. Drive | Si el código lee Drive por su cuenta y, si existe, mide cuánto tarda un cambio de prueba en verse | sincroniza y tarda ≤ 120 s | sincroniza pero no se pudo medir o tarda más | no hay sincronización |
| d. Base de datos | Código que escribe en una base o servidor, peticiones de escritura durante todos los clics del punto b, migraciones y lo que se guarda en el navegador | nadie escribe nada que no venga de Drive | solo se guardan cambios/preferencias en el navegador de cada persona | hay escrituras a una base o servidor que no vienen de Drive |

«Fallo real» de tsc = nombre sin definir (TS2304/TS2552), export inexistente, sintaxis (TS1xxx) o
import relativo a un archivo que no existe. Los demás errores (tipos del DOM sin anotar, imports
con `?v=`, paquetes sin tipos) se cuentan como avisos menores para vigilar que no crezcan.

En el punto b los enlaces externos no se abren (se bloquean en la prueba): se comprueba que el
botón responde. Un botón que ya marca la pantalla actual (`aria-current`) cuenta como que funciona.

## Medir la sincronización con Drive (cuando exista)

Nunca se editan documentos reales del equipo. La medición usa **solo** un archivo de prueba propio
llamado `PUERTA-prueba-no-editar` dentro de una carpeta de pruebas de Drive. Cuando el Atlas
sincronice, crea `scripts/puerta/drive-medir.mjs` que exporte `medir({ base, carpeta })`: cambia el
archivo de prueba, espera a que el cambio aparezca en el Atlas servido en `base` y devuelve los
segundos. La puerta lo usa solo si existe la variable `PUERTA_DRIVE_CARPETA_PRUEBAS` con el id de
esa carpeta (las credenciales nunca van al repositorio).

## Reglas

- La puerta no escribe en Drive ni en ninguna base, no despliega y no toca producción.
- Lo que no se pudo probar sale en amarillo o rojo con la razón; nunca en verde.
