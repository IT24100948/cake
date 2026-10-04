# ---------------------------------------------------------------------------
# Devma Cake n' Party - one-click local setup for Windows (Docker).
# Used by start.bat / stop.bat / reset.bat in the project folder.
#   devma.ps1            build + start everything, open the browser
#   devma.ps1 -Reset     wipe the database and start fresh with demo data
#   devma.ps1 -Stop      stop everything (data is kept)
# ---------------------------------------------------------------------------
param(
  [switch]$Reset,
  [switch]$Stop,
  [int]$Port = 8080
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
Set-Location -Path (Split-Path -Parent $PSScriptRoot)

function Say([string]$msg, [string]$color = 'Cyan') { Write-Host $msg -ForegroundColor $color }
function Fail([string]$msg) { Write-Host ""; Write-Host "  $msg" -ForegroundColor Red; Write-Host ""; exit 1 }

Write-Host ""
Say "  Devma Cake n' Party - local setup" 'Magenta'
Write-Host ""

# 1. Docker installed? -------------------------------------------------------
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Say "Docker Desktop is not installed. It is the only thing this project needs." 'Yellow'
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    $answer = Read-Host "Install Docker Desktop now? (Y/n)"
    if ($answer -eq '' -or $answer -match '^[Yy]') {
      winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
      Write-Host ""
      Say "Docker Desktop was installed." 'Green'
      Say "Next: restart Windows if asked, open Docker Desktop once (accept the terms), then run start.bat again." 'Green'
      exit 0
    }
  }
  Fail "Install Docker Desktop from https://www.docker.com/products/docker-desktop/ and run start.bat again."
}

# 2. Docker engine running? --------------------------------------------------
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  $desktop = Join-Path $Env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (Test-Path $desktop) {
    Say "Starting Docker Desktop (this can take a minute the first time)..."
    Start-Process -FilePath $desktop | Out-Null
  } else {
    Say "Please open Docker Desktop..." 'Yellow'
  }
  $deadline = (Get-Date).AddMinutes(5)
  do {
    Start-Sleep -Seconds 3
    Write-Host "." -NoNewline
    docker info *> $null
  } until ($LASTEXITCODE -eq 0 -or (Get-Date) -gt $deadline)
  Write-Host ""
  if ($LASTEXITCODE -ne 0) {
    Fail "Docker Desktop did not start. Open it manually, wait until it says 'Engine running', then run start.bat again."
  }
}
Say "Docker is running." 'Green'

# 3. Stop / reset -------------------------------------------------------------
if ($Stop) {
  docker compose down
  Say "Stopped. Your data is kept - run start.bat to continue where you left off." 'Green'
  exit 0
}
if ($Reset) {
  Say "Removing the database and uploaded images..." 'Yellow'
  docker compose down -v
}

# 4. Pick a free port (8080, or the next free one) ---------------------------
function Test-Ours([int]$p) {
  try { return (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:$p/api/health").Content -match '"ok"' }
  catch { return $false }
}
function Test-Busy([int]$p) {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $client.Connect('127.0.0.1', $p); return $true } catch { return $false } finally { $client.Close() }
}
$chosen = $Port
while ((Test-Busy $chosen) -and -not (Test-Ours $chosen)) {
  $chosen++
  if ($chosen -gt $Port + 20) { Fail "No free port found between $Port and $($Port + 20)." }
}
$Env:APP_PORT = "$chosen"
$mysqlPort = 3307
while (Test-Busy $mysqlPort) { $mysqlPort++ }
$Env:MYSQL_PORT = "$mysqlPort"

# 5. Build and start -----------------------------------------------------------
Say "Building and starting (first run downloads ~400 MB and takes 3-8 minutes)..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Fail "Docker could not start the project. Scroll up for the error, or run: docker compose logs" }

# 6. Wait until the app answers ------------------------------------------------
Say "Waiting for the database and app to be ready..."
$deadline = (Get-Date).AddMinutes(8)
while (-not (Test-Ours $chosen)) {
  if ((Get-Date) -gt $deadline) {
    docker compose logs --tail 60 app
    Fail "The app did not become ready in time. The log above shows why."
  }
  $state = docker compose ps app --format "{{.State}}" 2>$null
  if ($state -match 'exited|dead') {
    docker compose logs --tail 60 app
    Fail "The app stopped during start-up. The log above shows why."
  }
  Start-Sleep -Seconds 3
  Write-Host "." -NoNewline
}
Write-Host ""

# 7. Done ----------------------------------------------------------------------
$url = "http://localhost:$chosen"
Write-Host ""
Say "  ============================================================" 'Green'
Say "   READY:  $url" 'Green'
Say "  ============================================================" 'Green'
Write-Host ""
Write-Host "   Shop (customers):   $url"
Write-Host "   Staff portal:       $url/staff/login"
Write-Host ""
Write-Host "   All demo logins use the password:  Devma@2026"
Write-Host "     admin@devma.lk      Admin - everything incl. dashboard, staff, roles"
Write-Host "     staff@devma.lk      Shop Staff - orders, payments, delivery"
Write-Host "     support@devma.lk    Technical Support - staff accounts, audit log"
Write-Host "     customer@devma.lk   Customer - shop, build a cake, track orders"
Write-Host ""
Write-Host "   Database (optional, e.g. MySQL Workbench): localhost:$mysqlPort  user devma / devma-db-2026"
Write-Host ""
Write-Host "   Stop: stop.bat      Fresh start with demo data: reset.bat"
Write-Host ""
Start-Process $url
