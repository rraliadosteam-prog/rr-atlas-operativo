# Informe de gobierno documental

> Corte: **2026-10-27** · Fuente: `/home/deadkiss/RR-Grafo/atlas/grafo.json`
> Documentos indexados: **78** · Relaciones: **1863** · Con Drive: **78**

Este informe se calcula sobre la copia filtrada del vault. Las notas excluidas por sensibilidad no se leen; sus enlaces aparecen como «excluido», no como error.

## Resumen

| Hallazgo                                 | Cantidad |
|------------------------------------------|----------|
| Vencido por revisión                     | 58       |
| Sin owner                                | 1        |
| Sin fecha de corte                       | 1        |
| Sin registro en Drive                    | 0        |
| Huérfano (sin vínculos entre documentos) | 3        |
| Título duplicado                         | 0        |
| Enlace sin resolver                      | 3        |
| Enlace a documento excluido              | 68       |

## 1. Vencidos por revisión

**58 de 78** documentos tienen `revisar` o `vigente_hasta` anterior a hoy.

| Área       | Vencidos | Del área |
|------------|----------|----------|
| Empresa    | 13       | 76%      |
| Procesos   | 13       | 72%      |
| Mapa       | 8        | 72%      |
| Funciones  | 8        | 88%      |
| Sistema    | 7        | 63%      |
| Inicio     | 5        | 83%      |
| Onboarding | 4        | 80%      |


**Por owner**

| Owner                    | Vencidos |
|--------------------------|----------|
| Direccion                | 32       |
| Dirección                | 6        |
| Comercial                | 4        |
| Gobierno documental      | 3        |
| Partnerships / Comercial | 2        |
| tech-orchestrator / CEO  | 2        |
| Direccion tecnica        | 2        |
| IA_Y_Herramientas        | 2        |


**Los 15 más atrasados**

| Documento                 | Días | Revisar    | Owner                    |
|---------------------------|------|------------|--------------------------|
| LEGAL                     | 24   | 2026-10-03 | Admin / Legal            |
| estado_actual             | 24   | 2026-10-03 | Direccion + Operaciones  |
| INBOX                     | 24   | 2026-10-03 | Direccion                |
| proyectos                 | 12   | 2026-10-15 | Direccion                |
| GOBIERNO                  | 2    | 2026-10-25 | Gobierno documental      |
| mapa_de_fuentes           | 2    | 2026-10-25 | Gobierno documental      |
| 00_mapa_maestro_rr        | 1    | 2026-10-26 | Direccion                |
| 01_flujo_comercial_equipo | 1    | 2026-10-26 | Comercial                |
| ALIANZAS                  | 1    | 2026-10-26 | Partnerships / Comercial |
| COMERCIAL                 | 1    | 2026-10-26 | Comercial / CEO          |
| DESARROLLO                | 1    | 2026-10-26 | tech-orchestrator / CEO  |
| IA_Y_HERRAMIENTAS         | 1    | 2026-10-26 | tech-orchestrator / CEO  |
| SOPORTE                   | 1    | 2026-10-26 | TODO                     |
| herramientas_decisiones   | 1    | 2026-10-26 | Direccion                |
| 02_mapa_de_capacidades    | 1    | 2026-10-26 | Direccion                |

## 2. Sin owner o sin corte

| Documento   | Área | Falta                |
|-------------|------|----------------------|
| NOTA_RCLONE | Raíz | sin_owner, sin_corte |

## 3. Huérfanos

Documentos sin ninguna relación con otro documento del corpus.

| Documento                              | Área     | Vínculos totales |
|----------------------------------------|----------|------------------|
| NOTA_RCLONE                            | Raíz     | 1                |
| informacion_de_donde_sale_la_respuesta | Procesos | 1                |
| 01_DONDE_VIVE_CADA_TABLERO             | Sistema  | 1                |

## 4. Duplicados por título

_Sin duplicados._

## 5. Enlaces sin resolver

| Documento                                | Destino |
|------------------------------------------|---------|
| 90_Sistema/01_DONDE_VIVE_CADA_TABLERO.md | ...     |
| 10_Mapa/red_del_vault.md                 | ...     |
| 10_Mapa/red_del_vault.md                 | enlace  |

## 6. Enlaces a documentos excluidos

**68** enlaces apuntan a notas fuera del corpus indexado (protección por sensibilidad). No son errores: son decisiones de exclusión.

| Documento                        | Enlaces excluidos |
|----------------------------------|-------------------|
| INDICE_FUNCIONES                 | 11                |
| 00_RUTAS                         | 10                |
| 03_flujos_operativos             | 6                 |
| 00_HOME                          | 6                 |
| 00_constitucion_rr               | 5                 |
| INDICE_MAESTRO                   | 4                 |
| tablero_huecos                   | 3                 |
| ARQUITECTURA_DEL_SEGUNDO_CEREBRO | 3                 |
| 00_mapa_maestro_rr               | 2                 |
| estado_actual                    | 2                 |
| GLOSARIO                         | 2                 |
| 02_alta_de_integrante            | 2                 |

## 7. Cobertura de Drive

**78 de 78** documentos tienen `fileId` de Drive verificado por md5.

