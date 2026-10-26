#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  printf '%s\n' 'Node.js 22+ LTS is required / Node.js 22+ LTS est nécessaire.' 'Install from https://nodejs.org/ then run setup.sh again.'
  for manager in apt-get dnf yum pacman zypper apk brew; do
    if command -v "$manager" >/dev/null 2>&1; then printf 'Detected package manager / Gestionnaire détecté: %s\n' "$manager"; break; fi
  done
  printf '%s\n' 'No administrator command was run / Aucune commande administrateur exécutée.'
  exit 1
fi
exec node scripts/setup.mjs "$@"
