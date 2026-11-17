"""Puente pytest para el bloque b6a (Atlas · dataset público).

El repo del Atlas prueba con `node --test` (no hay pytest en su toolchain y no
se instala nada en el venv de Hermes). Este archivo deja el comando estándar
del runner funcionando:

    /home/deadkiss/rr-encargos/2026-11-16_bloques/venv-test/bin/python \
        -m pytest -q -p no:cacheprovider tests/test_atlas_dataset_publico.py

Ejecuta SOLO las pruebas de este bloque (las que toqué):
  - src/data/dataset-publico.test.mjs   (dataset público, sanitización, build)
  - src/data/rr-tree.test.mjs            (el grafo que consume el dataset)
  - scripts/build.test.mjs               (guardarraíl *.local.* y contadores)
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
NODE = shutil.which("node")

ARCHIVOS_NODE = [
    "src/data/dataset-publico.test.mjs",
    "src/data/rr-tree.test.mjs",
    "scripts/build.test.mjs",
]


def _correr_node(archivos: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", "--test", *archivos],
        cwd=RAIZ,
        capture_output=True,
        text=True,
        timeout=600,
        check=False,
    )


@pytest.mark.skipif(NODE is None, reason="node no está disponible en esta máquina")
@pytest.mark.parametrize("archivo", ARCHIVOS_NODE)
def test_archivo_de_pruebas_node_en_verde(archivo: str) -> None:
    resultado = _correr_node([archivo])
    salida = resultado.stdout + resultado.stderr
    assert resultado.returncode == 0, f"{archivo} falló:\n{salida[-4000:]}"
    assert "fail 0" in salida, f"{archivo} reporta pruebas fallidas:\n{salida[-4000:]}"


@pytest.mark.skipif(NODE is None, reason="node no está disponible en esta máquina")
def test_build_de_produccion_sin_placeholders_y_sin_datos_locales() -> None:
    """El build de producción no puede volver a publicar el «0» fijo."""
    resultado = subprocess.run(
        ["node", "scripts/build.mjs"],
        cwd=RAIZ,
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
    )
    assert resultado.returncode == 0, resultado.stdout + resultado.stderr
    html = (RAIZ / "dist" / "index.html").read_text(encoding="utf-8")
    assert "{{" not in html, "Quedaron placeholders sin reemplazar en el build"
    assert "data-node-count>0<" not in html, "El build volvió a publicar 0 nodos"
    assert "data-process-count>49<" in html, "El build no publica el conteo de procesos"
    assert (RAIZ / "dist" / "src" / "data" / "dataset-publico.mjs").is_file()
    assert (RAIZ / "dist" / "src" / "data" / "flujos-publicos.mjs").is_file()
