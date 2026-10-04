#!/usr/bin/env bash
# Devma Cake n' Party - stop (macOS/Linux, uses Docker)
exec "$(dirname "$0")/scripts/devma.sh" stop "$@"
