#!/usr/bin/env bash
# Short-install entry point served from GitHub Pages.
#
#   curl -fsSL https://abinashbir.github.io/netspeed/install.sh | bash
#
# This is only a thin wrapper: it fetches the real bootstrap script from the
# repository (single source of truth) and runs it.
set -euo pipefail

BOOTSTRAP="https://raw.githubusercontent.com/abinashbir/netspeed/main/scripts/bootstrap.sh"

exec bash <(curl -fsSL "$BOOTSTRAP") "$@"
