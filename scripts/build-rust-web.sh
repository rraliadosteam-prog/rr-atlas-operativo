#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

export PATH="$HOME/.cargo/bin:$PATH"
CACHE_DIR="$ROOT_DIR/.cache"
mkdir -p "$CACHE_DIR"

if ! command -v rustup >/dev/null 2>&1; then
  INSTALLER="$CACHE_DIR/rustup-init.sh"
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
    https://sh.rustup.rs -o "$INSTALLER"
  sh "$INSTALLER" -y --profile minimal --default-toolchain stable
fi

if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi

# Trunk 0.21 parses NO_COLOR as a boolean; normalize the common shell values
# used by CI and local shells before invoking it.
case "${NO_COLOR:-}" in
  1|true|TRUE|True) export NO_COLOR=true ;;
  0|false|FALSE|False) export NO_COLOR=false ;;
esac

rustup target add wasm32-unknown-unknown

if ! command -v trunk >/dev/null 2>&1; then
  cargo install trunk --version 0.21.14 --locked
fi

rm -rf dist
trunk build --release --config crates/atlas-web/Trunk.toml --dist "$ROOT_DIR/dist"

if [ ! -f dist/index.html ]; then
  printf 'error: Trunk no genero dist/index.html\n' >&2
  exit 1
fi

printf 'Atlas Rust build: dist/index.html\n'
