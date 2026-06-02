# start-all.ps1 — Démarre toute la stack Vinted Bot Web + tunnel public ngrok.
#
# Usage :
#   powershell -ExecutionPolicy Bypass -File start-all.ps1
#
# Idempotent : relançable sans rien dupliquer (ne redémarre que ce qui est tombé).
# Pour tout arrêter, voir la commande affichée à la fin.

# ── Config ───────────────────────────────────────────────
$Domain      = 'exes-turf-thrift.ngrok-free.dev'
$BackendPort = 3001
$FrontPort   = 5800
$PgContainer = 'vinted-pg'

$Root     = $PSScriptRoot
$Backend  = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'

# PATH frais (docker/node/ngrok installés via winget ne sont pas toujours
# présents dans une session héritée).
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path','User')

function Test-Port($port) {
  $null -ne (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

Write-Host '=== Vinted Bot Web — démarrage ===' -ForegroundColor Cyan

# 1. PostgreSQL (conteneur Docker)
Write-Host "[1/4] PostgreSQL ($PgContainer)..." -ForegroundColor Yellow
docker start $PgContainer | Out-Null
$pgReady = $false
for ($i = 0; $i -lt 30; $i++) {
  $r = docker exec $PgContainer pg_isready -U postgres 2>&1
  if ($r -match 'accepting connections') { $pgReady = $true; break }
  Start-Sleep -Seconds 1
}
Write-Host ("      " + $(if ($pgReady) { 'prêt.' } else { 'NON prêt — vérifier Docker Desktop.' }))

# 2. Backend Express
Write-Host "[2/4] Backend (port $BackendPort)..." -ForegroundColor Yellow
if (Test-Port $BackendPort) {
  Write-Host '      déjà démarré.'
} else {
  Start-Process node -ArgumentList '--env-file=.env', 'index.js' -WorkingDirectory $Backend `
    -RedirectStandardOutput (Join-Path $Backend 'backend.log') `
    -RedirectStandardError  (Join-Path $Backend 'backend.err.log') -WindowStyle Hidden
  for ($i = 0; $i -lt 20; $i++) {
    try { if ((Invoke-RestMethod "http://localhost:$BackendPort/api/health" -TimeoutSec 2).success) { break } } catch {}
    Start-Sleep -Seconds 1
  }
  Write-Host '      lancé.'
}

# 3. Frontend (Vite dev server)
Write-Host "[3/4] Frontend (port $FrontPort)..." -ForegroundColor Yellow
if (Test-Port $FrontPort) {
  Write-Host '      déjà démarré.'
} else {
  Start-Process node -ArgumentList 'node_modules\vite\bin\vite.js', '--host', '127.0.0.1', '--port', "$FrontPort" `
    -WorkingDirectory $Frontend `
    -RedirectStandardOutput (Join-Path $Frontend 'frontend.log') `
    -RedirectStandardError  (Join-Path $Frontend 'frontend.err.log') -WindowStyle Hidden
  for ($i = 0; $i -lt 20; $i++) { if (Test-Port $FrontPort) { break }; Start-Sleep -Seconds 1 }
  Write-Host '      lancé.'
}

# 4. Tunnel ngrok (URL publique stable)
Write-Host '[4/4] Tunnel ngrok...' -ForegroundColor Yellow
if (Get-Process ngrok -ErrorAction SilentlyContinue) {
  Write-Host '      déjà démarré.'
} else {
  Start-Process ngrok -ArgumentList 'http', "--url=https://$Domain", "$FrontPort" `
    -RedirectStandardOutput (Join-Path $Root 'ngrok.log') `
    -RedirectStandardError  (Join-Path $Root 'ngrok.err.log') -WindowStyle Hidden
  Start-Sleep -Seconds 6
}

# ── Résumé ───────────────────────────────────────────────
Write-Host ''
Write-Host '=== Prêt ===' -ForegroundColor Green
Write-Host ("  Public : https://{0}" -f $Domain) -ForegroundColor Green
Write-Host ("  Local  : http://localhost:{0}" -f $FrontPort)
Write-Host ''
Write-Host '  Tout arrêter :' -ForegroundColor DarkGray
Write-Host '    Get-Process node,ngrok -ErrorAction SilentlyContinue | Stop-Process -Force; docker stop vinted-pg' -ForegroundColor DarkGray
