"""Puente pytest del bloque b6b (Atlas · build de producción + preview local + enlace al hub).

El repo del Atlas prueba con `node --test` (no hay pytest en su toolchain y no se
instala nada en el venv de Hermes). Este archivo deja el comando estándar del
runner funcionando:

    /home/deadkiss/rr-encargos/2026-11-16_bloques/venv-test/bin/python \
        -m pytest -q -p no:cacheprovider tests/test_atlas_build_hub.py

Ejecuta SOLO las pruebas de este bloque (las que toqué):
  - src/app/atlas-build-hub.test.mjs  (build de producción + preview local + enlace al hub)
  - src/data/hub-link.test.mjs          (URL del hub y override local)
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
NODE = shutil.which("node")
HUB_URL = "https://rr-aliados-mega-dashboard.vercel.app/"

ARCHIVOS_NODE = [
    "src/app/atlas-build-hub.test.mjs",
    "src/data/hub-link.test.mjs",
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
def test_build_de_produccion_publica_nodos_y_enlace_al_hub() -> None:
    """El build de producción debe contar más de 0 nodos y enlazar al hub."""
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
    assert HUB_URL in html, "El build debe enlazar al hub RR Aliados"
    assert "data-node-count>0<" not in html, "El build volvió a publicar 0 nodos"
    assert "data-node-count>" in html, "El build no publica el contador de nodos"
    assert "data-process-count>" in html, "El build no publica el conteo de procesos"
