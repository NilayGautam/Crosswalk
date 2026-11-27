#!/bin/sh
# Installs the `crosswalk` command. It needs nothing but this script: uv is
# installed first when it is missing, and uv brings its own Python.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v uv >/dev/null 2>&1; then
  echo "Installing uv, which runs the crosswalk command..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi

uv tool install --force --python 3.13 "$ROOT/cli"

if command -v crosswalk >/dev/null 2>&1; then
  echo
  echo "Installed. Next: run 'crosswalk login'."
else
  echo
  echo "Installed, but your shell cannot find it yet. Run 'uv tool update-shell',"
  echo "open a new terminal window, and then run 'crosswalk login'."
fi
