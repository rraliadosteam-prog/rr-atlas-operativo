# Informe de gobierno documental

> Corte: **2026-10-27** · Fuente: `/home/deadkiss/RR-Grafo/atlas/grafo.json`
> Documentos indexados: **78** · Relaciones: **1863** · Con Drive: **0**

Este informe se calcula sobre la copia filtrada del vault. Las notas excluidas por sensibilidad no se leen; sus enlaces aparecen como «excluido», no como error.

## Resumen

| Hallazgo                                 | Cantidad |
|------------------------------------------|----------|
| Vencido por revisión                     | 58       |
| Sin owner                                | 1        |
| Sin fecha de corte                       | 1        |
| Sin registro en Drive                    | 78       |
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

**0 de 78** documentos tienen `fileId` de Drive verificado por md5.

| Documento                                                  | Archivo                                                                   |
|------------------------------------------------------------|---------------------------------------------------------------------------|
| 00_mapa_maestro_rr                                         | 10_Mapa/00_mapa_maestro_rr.md                                             |
| 01_flujo_comercial_equipo                                  | 40_Onboarding/01_flujo_comercial_equipo.md                                |
| ALIANZAS                                                   | 30_Funciones/ALIANZAS.md                                                  |
| COMERCIAL                                                  | 30_Funciones/COMERCIAL.md                                                 |
| DESARROLLO                                                 | 30_Funciones/DESARROLLO.md                                                |
| GOBIERNO                                                   | 30_Funciones/GOBIERNO.md                                                  |
| IA_Y_HERRAMIENTAS                                          | 30_Funciones/IA_Y_HERRAMIENTAS.md                                         |
| LEGAL                                                      | 30_Funciones/LEGAL.md                                                     |
| SOPORTE                                                    | 30_Funciones/SOPORTE.md                                                   |
| PRODUCCION                                                 | 30_Funciones/PRODUCCION.md                                                |
| herramientas_decisiones                                    | 20_Empresa/herramientas_decisiones.md                                     |
| identidad                                                  | 20_Empresa/identidad.md                                                   |
| 02_mapa_de_capacidades                                     | 10_Mapa/02_mapa_de_capacidades.md                                         |
| estado_actual                                              | 20_Empresa/estado_actual.md                                               |
| mapa_de_fuentes                                            | 20_Empresa/mapa_de_fuentes.md                                             |
| flota_ia                                                   | 20_Empresa/flota_ia.md                                                    |
| 01_cadena_de_valor                                         | 10_Mapa/01_cadena_de_valor.md                                             |
| 03_flujos_operativos                                       | 10_Mapa/03_flujos_operativos.md                                           |
| 04_raci_y_decisiones                                       | 10_Mapa/04_raci_y_decisiones.md                                           |
| ia_como_se_usa_la_ia_en_rr_aliados                         | 30_Procesos/ia_como_se_usa_la_ia_en_rr_aliados.md                         |
| tablero_huecos                                             | 10_Mapa/tablero_huecos.md                                                 |
| COBERTURA_DRIVE                                            | 20_Empresa/COBERTURA_DRIVE.md                                             |
| 03_12_playbooks_faltantes                                  | 10_Mapa/03_12_playbooks_faltantes.md                                      |
| 03_11_flujo_segmentos                                      | 10_Mapa/03_11_flujo_segmentos.md                                          |
| onboarding_dia_1_a_dia_30                                  | 40_Onboarding/onboarding_dia_1_a_dia_30.md                                |
| playbook_comercial_bpmn                                    | 10_Mapa/playbook_comercial_bpmn.md                                        |
| area_alianzas                                              | 30_Procesos/area_alianzas.md                                              |
| 00_HUECOS                                                  | 00_HUECOS.md                                                              |
| area_comercial                                             | 30_Procesos/area_comercial.md                                             |
| area_desarrollo                                            | 30_Procesos/area_desarrollo.md                                            |
| area_gobierno                                              | 30_Procesos/area_gobierno.md                                              |
| area_ia_y_herramientas                                     | 30_Procesos/area_ia_y_herramientas.md                                     |
| departamentos_rr_aliados                                   | 30_Procesos/departamentos_rr_aliados.md                                   |
| reunion_directivos_las_9_areas                             | 30_Procesos/reunion_directivos_las_9_areas.md                             |
| area_legal                                                 | 30_Procesos/area_legal.md                                                 |
| area_produccion                                            | 30_Procesos/area_produccion.md                                            |
| area_soporte                                               | 30_Procesos/area_soporte.md                                               |
| pendientes_ia                                              | 20_Empresa/pendientes_ia.md                                               |
| estrategia                                                 | 20_Empresa/estrategia.md                                                  |
| ventas                                                     | 20_Empresa/ventas.md                                                      |
| marca                                                      | 20_Empresa/marca.md                                                       |
| GLOSARIO                                                   | 90_Sistema/GLOSARIO.md                                                    |
| produccion_rr                                              | 20_Empresa/produccion_rr.md                                               |
| equipo                                                     | 20_Empresa/equipo.md                                                      |
| 02_alta_de_integrante                                      | 40_Onboarding/02_alta_de_integrante.md                                    |
| vacantes_rr_aliados                                        | 40_Onboarding/vacantes_rr_aliados.md                                      |
| 00_HOME                                                    | 00_HOME.md                                                                |
| 00_RUTAS                                                   | 00_RUTAS.md                                                               |
| INDICE_MAESTRO                                             | 90_Sistema/INDICE_MAESTRO.md                                              |
| INDICE_FUNCIONES                                           | 30_Funciones/INDICE_FUNCIONES.md                                          |
| PROTOCOLO                                                  | 90_Sistema/PROTOCOLO.md                                                   |
| plantilla_funcion                                          | 90_Sistema/plantillas/plantilla_funcion.md                                |
| desarrollo_como_llega_un_producto_de_software_a_produccion | 30_Procesos/desarrollo_como_llega_un_producto_de_software_a_produccion.md |
| produccion_como_se_hace_una_pieza                          | 30_Procesos/produccion_como_se_hace_una_pieza.md                          |
| 20_Empresa/linea_base_de_los_36_indicadores                | 20_Empresa/linea_base_de_los_36_indicadores.md                            |
| 00_DIAGRAMA_MAESTRO                                        | 00_DIAGRAMA_MAESTRO.md                                                    |
| linea_base_kpi                                             | 20_Empresa/linea_base_kpi.md                                              |
| 00_INDICE_ONBOARDING                                       | 40_Onboarding/00_INDICE_ONBOARDING.md                                     |
| productos                                                  | 20_Empresa/productos.md                                                   |
| proyectos                                                  | 20_Empresa/proyectos.md                                                   |
| NOTA_RCLONE                                                | _herramientas/NOTA_RCLONE.md                                              |
| 00_LEEME                                                   | 00_LEEME.md                                                               |
| GUIA_OBSIDIAN_CANVAS                                       | 90_Sistema/GUIA_OBSIDIAN_CANVAS.md                                        |
| alianzas_como_nace_una_alianza                             | 30_Procesos/alianzas_como_nace_una_alianza.md                             |
| informacion_de_donde_sale_la_respuesta                     | 30_Procesos/informacion_de_donde_sale_la_respuesta.md                     |
| auditoria_numa                                             | 20_Empresa/auditoria_numa.md                                              |
| ARQUITECTURA_DEL_SEGUNDO_CEREBRO                           | 90_Sistema/ARQUITECTURA_DEL_SEGUNDO_CEREBRO.md                            |
| ia_como_se_convierte_un_trabajo_repetitivo_en_un_agente    | 30_Procesos/ia_como_se_convierte_un_trabajo_repetitivo_en_un_agente.md    |
| gobierno_como_se_gobierna_la_documentacion                 | 30_Procesos/gobierno_como_se_gobierna_la_documentacion.md                 |
| 01_DONDE_VIVE_CADA_TABLERO                                 | 90_Sistema/01_DONDE_VIVE_CADA_TABLERO.md                                  |
| 30_Procesos/linea_base_de_los_36_indicadores               | 30_Procesos/linea_base_de_los_36_indicadores.md                           |
| DONDE_ESTA_EL_VAULT                                        | 90_Sistema/DONDE_ESTA_EL_VAULT.md                                         |
| INBOX                                                      | 00_Inbox/INBOX.md                                                         |
| 00_constitucion_rr                                         | 10_Mapa/00_constitucion_rr.md                                             |
| COMO_VERIFICAR                                             | 90_Sistema/COMO_VERIFICAR.md                                              |
| red_del_vault                                              | 10_Mapa/red_del_vault.md                                                  |
| COMO_VER_LOS_DIAGRAMAS                                     | 90_Sistema/COMO_VER_LOS_DIAGRAMAS.md                                      |
| ARRANQUE_DE_SESION                                         | 90_Sistema/ARRANQUE_DE_SESION.md                                          |

