#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 20 or newer from https://nodejs.org, then open this file again."
  read -r -p "Press Enter to close. "
  exit 1
fi
if [ ! -f dist/index.html ]; then
  echo "The built app is missing. Run npm install and npm run build first."
  read -r -p "Press Enter to close. "
  exit 1
fi
( sleep 1; open "http://localhost:${PORT:-4173}" ) &
node scripts/serve.mjs
read -r -p "Press Enter to close. "
