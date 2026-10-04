#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Devma Cake n' Party - one-command local setup for macOS / Linux (Docker).
#   ./start.sh            build + start everything, open the browser
#   ./start.sh reset      wipe the database and start fresh with demo data
#   ./start.sh stop       stop everything (data is kept)
# ---------------------------------------------------------------------------
set -u
cd "$(dirname "$0")/.."

say()  { printf '\033[36m%s\033[0m\n' "$*"; }
ok()   { printf '\033[32m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m  %s\033[0m\n\n' "$*"; exit 1; }

ACTION="${1:-start}"
PORT="${PORT:-8080}"

printf '\n\033[35m  Devma Cake n'"'"' Party - local setup\033[0m\n\n'

# 1. Docker installed? -------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  warn "Docker is not installed. It is the only thing this project needs."
  if [[ "$(uname)" == "Darwin" ]]; then
    echo "  Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    command -v brew >/dev/null 2>&1 && echo "  (or: brew install --cask docker)"
  else
    echo "  Install Docker Engine: https://docs.docker.com/engine/install/  (or: curl -fsSL https://get.docker.com | sh)"
  fi
  fail "Then run ./start.sh again."
fi

# 2. Docker engine running? --------------------------------------------------
if ! docker info >/dev/null 2>&1; then
  if [[ "$(uname)" == "Darwin" ]]; then
    say "Starting Docker Desktop (this can take a minute)..."
    open -a Docker 2>/dev/null || true
  else
    say "Starting the Docker service..."
    (sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null) || true
  fi
  for _ in $(seq 1 100); do docker info >/dev/null 2>&1 && break; printf '.'; sleep 3; done
  echo
  docker info >/dev/null 2>&1 || fail "Docker did not start. Open Docker Desktop, wait for 'Engine running', then run ./start.sh again."
fi
ok "Docker is running."

# 3. Stop / reset -------------------------------------------------------------
if [[ "$ACTION" == "stop" ]]; then
  docker compose down
  ok "Stopped. Your data is kept - run ./start.sh to continue."
  exit 0
fi
if [[ "$ACTION" == "reset" ]]; then
  warn "Removing the database and uploaded images..."
  docker compose down -v
fi

# 4. Pick free ports ------------------------------------------------------------
is_ours() { curl -fs --max-time 2 "http://localhost:$1/api/health" 2>/dev/null | grep -q '"ok"'; }
is_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
APP_PORT=$PORT
while is_busy "$APP_PORT" && ! is_ours "$APP_PORT"; do
  APP_PORT=$((APP_PORT + 1)); [[ $APP_PORT -gt $((PORT + 20)) ]] && fail "No free port found near $PORT."
done
MYSQL_PORT=3307
while is_busy "$MYSQL_PORT"; do MYSQL_PORT=$((MYSQL_PORT + 1)); done
export APP_PORT MYSQL_PORT

# 5. Build and start -----------------------------------------------------------
say "Building and starting (first run downloads ~400 MB and takes 3-8 minutes)..."
docker compose up -d --build || fail "Docker could not start the project. See the error above, or run: docker compose logs"

# 6. Wait until the app answers ------------------------------------------------
say "Waiting for the database and app to be ready..."
for i in $(seq 1 160); do
  is_ours "$APP_PORT" && break
  if docker compose ps app --format '{{.State}}' 2>/dev/null | grep -Eq 'exited|dead'; then
    docker compose logs --tail 60 app; fail "The app stopped during start-up. The log above shows why."
  fi
  [[ $i -eq 160 ]] && { docker compose logs --tail 60 app; fail "The app did not become ready in time."; }
  printf '.'; sleep 3
done
echo

# 7. Done ----------------------------------------------------------------------
URL="http://localhost:$APP_PORT"
echo
ok "  ============================================================"
ok "   READY:  $URL"
ok "  ============================================================"
cat <<EOF

   Shop (customers):   $URL
   Staff portal:       $URL/staff/login

   All demo logins use the password:  Devma@2026
     admin@devma.lk      Admin - everything incl. dashboard, staff, roles
     staff@devma.lk      Shop Staff - orders, payments, delivery
     support@devma.lk    Technical Support - staff accounts, audit log
     customer@devma.lk   Customer - shop, build a cake, track orders

   Database (optional): localhost:$MYSQL_PORT  user devma / devma-db-2026

   Stop: ./start.sh stop      Fresh start with demo data: ./start.sh reset

EOF
if command -v open >/dev/null 2>&1; then open "$URL"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 & fi
