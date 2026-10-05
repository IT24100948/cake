#!/usr/bin/env bash
# Devma Cake n' Party - start everything (macOS/Linux). Needs Node.js 20+ and a running MySQL server.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Node.js is not installed. Get it from https://nodejs.org (LTS), then run ./start.sh again."; exit 1; }
[ -d node_modules ] || npm install --no-audit --no-fund || exit 1
exec node scripts/start.js "$@"
