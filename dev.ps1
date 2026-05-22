<#
.SYNOPSIS
  One-command launch for the Praxisa platform (local dev).

.DESCRIPTION
  Starts Docker services (Postgres, Redis, Mailpit), runs DB migrations,
  seeds demo data, then launches the API and Web dev servers in parallel.

  First run:  ./dev.ps1          (full setup + start)
  Quick run:  ./dev.ps1 -Quick   (skip Docker/migrate/seed, just start servers)
  Reset DB:   ./dev.ps1 -Reset   (wipe volumes, re-migrate, re-seed)

.EXAMPLE
  ./dev.ps1
  ./dev.ps1 -Quick
  ./dev.ps1 -Reset
#>

param(
  [switch]$Quick,
  [switch]$Reset
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# ── Colours ──────────────────────────────────────────────────────────────────

function Write-Step($msg) { Write-Host "`n[$((Get-Date).ToString('HH:mm:ss'))] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  !!  $msg" -ForegroundColor Yellow }

# ── Pre-flight checks ───────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ____                 _           " -ForegroundColor Cyan
Write-Host " |  _ \ _ __ __ ___  _(_)___  __ _ " -ForegroundColor Cyan
Write-Host " | |_) | '__/ _`` \ \/ / / __|/ _`` |" -ForegroundColor Cyan
Write-Host " |  __/| | | (_| |>  <| \__ \ (_| |" -ForegroundColor Cyan
Write-Host " |_|   |_|  \__,_/_/\_\_|___/\__,_|" -ForegroundColor Cyan
Write-Host ""
Write-Host " Local Development Launcher" -ForegroundColor DarkGray
Write-Host ""

# Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: Docker is not installed or not in PATH." -ForegroundColor Red
  Write-Host "Install Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
  exit 1
}

# Check pnpm
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: pnpm is not installed or not in PATH." -ForegroundColor Red
  Write-Host "Install: npm install -g pnpm" -ForegroundColor Yellow
  exit 1
}

# Check Node version
$nodeVersion = (node --version) -replace 'v',''
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 20) {
  Write-Host "ERROR: Node.js >= 20 required (found v$nodeVersion)." -ForegroundColor Red
  exit 1
}

# Check .env
if (-not (Test-Path ".env")) {
  Write-Step "Creating .env from .env.example..."
  Copy-Item ".env.example" ".env"
  Write-Warn ".env created — review it and add JWT keys if needed."
  Write-Warn "See .env.example for instructions on generating JWT keys."
}

# ── Quick mode — skip infra, just start servers ─────────────────────────────

if ($Quick) {
  Write-Step "Quick mode — starting dev servers only..."
  Write-Host ""
  Write-Host "  API  -> http://localhost:3000" -ForegroundColor Green
  Write-Host "  Web  -> http://localhost:5173" -ForegroundColor Green
  Write-Host "  Mail -> http://localhost:8025" -ForegroundColor DarkGray
  Write-Host ""
  Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
  Write-Host ""

  $api = Start-Process pnpm -ArgumentList "dev:api" -NoNewWindow -PassThru
  $web = Start-Process pnpm -ArgumentList "dev:web" -NoNewWindow -PassThru

  try { Wait-Process -Id $api.Id, $web.Id }
  catch { }
  finally {
    try { Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue } catch { }
    try { Stop-Process -Id $web.Id -Force -ErrorAction SilentlyContinue } catch { }
  }
  exit 0
}

# ── Reset mode — wipe Docker volumes ────────────────────────────────────────

if ($Reset) {
  Write-Step "Resetting Docker volumes..."
  docker compose down -v
  Write-Ok "Volumes removed."
}

# ── 1. Docker services ──────────────────────────────────────────────────────

Write-Step "Starting Docker services (Postgres, Redis, Mailpit)..."
docker compose up -d
Write-Ok "Docker services running."

# Wait for Postgres to accept connections
Write-Step "Waiting for Postgres to be ready..."
$retries = 0
do {
  $retries++
  Start-Sleep -Seconds 1
  $health = docker inspect --format='{{.State.Health.Status}}' praxisa-postgres 2>$null
} while ($health -ne "healthy" -and $retries -lt 30)

if ($health -ne "healthy") {
  Write-Host "ERROR: Postgres did not become healthy in 30s." -ForegroundColor Red
  docker logs praxisa-postgres --tail 20
  exit 1
}
Write-Ok "Postgres ready."

# ── 2. Dependencies ─────────────────────────────────────────────────────────

Write-Step "Installing dependencies..."
pnpm install --frozen-lockfile 2>$null
if ($LASTEXITCODE -ne 0) {
  # If lockfile changed, install without frozen
  pnpm install
}
Write-Ok "Dependencies installed."

# ── 3. Migrations ───────────────────────────────────────────────────────────

Write-Step "Running database migrations..."
pnpm db:migrate
Write-Ok "Migrations applied."

# ── 4. Seed data ────────────────────────────────────────────────────────────

Write-Step "Seeding demo data..."
pnpm db:seed
Write-Ok "Demo data seeded."

# ── 5. Start dev servers ────────────────────────────────────────────────────

Write-Step "Starting dev servers..."
Write-Host ""
Write-Host "  +-----------------------------------------+" -ForegroundColor Green
Write-Host "  |                                         |" -ForegroundColor Green
Write-Host "  |   API  -> http://localhost:3000          |" -ForegroundColor Green
Write-Host "  |   Web  -> http://localhost:5173          |" -ForegroundColor Green
Write-Host "  |   Mail -> http://localhost:8025          |" -ForegroundColor Green
Write-Host "  |   DB   -> localhost:5432                 |" -ForegroundColor Green
Write-Host "  |                                         |" -ForegroundColor Green
Write-Host "  +-----------------------------------------+" -ForegroundColor Green
Write-Host ""
Write-Host "  Demo accounts:" -ForegroundColor Yellow
Write-Host "    Admin   -> admin@praxisa.fr / Admin1234!" -ForegroundColor DarkGray
Write-Host "    Teacher -> prof.martin@praxisa.fr / Teacher1234!" -ForegroundColor DarkGray
Write-Host "    Student -> marie.dupont@praxisa.fr / Student1234!" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

$api = Start-Process pnpm -ArgumentList "dev:api" -NoNewWindow -PassThru
$web = Start-Process pnpm -ArgumentList "dev:web" -NoNewWindow -PassThru

try { Wait-Process -Id $api.Id, $web.Id }
catch { }
finally {
  try { Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue } catch { }
  try { Stop-Process -Id $web.Id -Force -ErrorAction SilentlyContinue } catch { }
}
