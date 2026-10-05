#!/usr/bin/env bash
# Devma Cake n' Party - wipe the database and load fresh demo data (macOS/Linux).
cd "$(dirname "$0")" || exit 1
[ -d node_modules ] || npm install --no-audit --no-fund || exit 1
exec node scripts/setup.js --reset "$@"
