# ============================================================
# Intelligent Commerce System
# ============================================================
# First time:  make build   (installs everything, seeds ML)
# After that:  make run     (just starts all services)
# Stop:        make stop
# ============================================================

SHELL = powershell.exe
.SHELLFLAGS = -NoProfile -Command

.PHONY: build run stop clean deps infra start-all seed-ml check-deps

# --- Configuration ---
ML_VENV = ml_engine\.venv
PYTHON = $(ML_VENV)\Scripts\python.exe
PIP = $(ML_VENV)\Scripts\pip.exe

# ============================================================
# make build — ONE-TIME SETUP (run this first on a fresh clone)
# ============================================================
build: check-deps infra deps-go deps-client deps-ml wait-infra seed-ml
	Write-Host "`n============================================" -ForegroundColor Green
	Write-Host "  BUILD COMPLETE" -ForegroundColor Green
	Write-Host "============================================" -ForegroundColor Green
	Write-Host "  Now run: make run"

# ============================================================
# make run — START ALL SERVICES (after build)
# ============================================================
run: infra start-all
	Write-Host "`n============================================" -ForegroundColor Cyan
	Write-Host "  All services running!" -ForegroundColor Cyan
	Write-Host "============================================"
	Write-Host "  Frontend:    http://localhost:5173"
	Write-Host "  Backend:     http://localhost:8080"
	Write-Host "  ML Engine:   http://localhost:8000"
	Write-Host "  RabbitMQ UI: http://localhost:15672"
	Write-Host "  Admin Panel: http://localhost:3001"
	Write-Host "============================================"
	Write-Host "  Stop with: make stop"
	Write-Host "============================================`n"

# ============================================================
# make stop — STOP EVERYTHING
# ============================================================
stop:
	Write-Host "Stopping services..."
	Get-Process -ErrorAction SilentlyContinue | Where-Object { $$_.MainWindowTitle -match "ml-engine|go-server|vite-client|admin-panel" } | Stop-Process -Force -ErrorAction SilentlyContinue
	docker compose down
	Write-Host "All stopped."

# ============================================================
# make clean — FULL RESET
# ============================================================
clean: stop
	if (Test-Path "ml_engine\.venv") { Remove-Item -Recurse -Force "ml_engine\.venv" }
	if (Test-Path "Client\node_modules") { Remove-Item -Recurse -Force "Client\node_modules" }
	docker compose down -v
	Write-Host "Cleaned."

# ============================================================
# INTERNAL TARGETS
# ============================================================

check-deps:
	Write-Host "Checking prerequisites..."
	$$missing = @(); if (!(Get-Command docker -EA SilentlyContinue)) { $$missing += "Docker" }; if (!(Get-Command go -EA SilentlyContinue)) { $$missing += "Go" }; if (!(Get-Command node -EA SilentlyContinue)) { $$missing += "Node.js" }; if (!(Get-Command python -EA SilentlyContinue)) { $$missing += "Python" }; if ($$missing.Count -gt 0) { Write-Host "ERROR: Missing: $$missing" -ForegroundColor Red; exit 1 }; Write-Host "All prerequisites found."

infra:
	Write-Host "Starting Docker (Redis, RabbitMQ, PostgreSQL+pgvector)..."
	docker compose up -d

wait-infra:
	Write-Host "Waiting for infra to be ready..."
	Start-Sleep -Seconds 15

deps-go:
	Write-Host "[1/3] Installing Go dependencies..."
	Push-Location Server; go mod download; Pop-Location

deps-client:
	Write-Host "[2/3] Installing Node.js dependencies..."
	Push-Location Client; npm install --silent; Pop-Location

deps-ml:
	Write-Host "[3/3] Installing Python ML dependencies..."
	if (!(Test-Path "$(ML_VENV)")) { python -m venv ml_engine\.venv }
	& "$(PIP)" install -q -r ml_engine/requirements.txt

start-all:
	Write-Host "Starting ML Engine (port 8000)..."
	Start-Process -FilePath "$(PYTHON)" -ArgumentList "-m","uvicorn","ml_engine.main:app","--host","0.0.0.0","--port","8000" -WindowStyle Normal
	Write-Host "Waiting for ML Engine to load model (~45s)..."
	Start-Sleep -Seconds 45
	Write-Host "Starting Go Backend (port 8080)..."
	Start-Process -FilePath "go" -ArgumentList "run","main.go" -WorkingDirectory "Server" -WindowStyle Normal
	Write-Host "Waiting for backend to connect (~30s)..."
	Start-Sleep -Seconds 30
	Write-Host "Starting Vite Frontend (port 5173)..."
	Start-Process -FilePath "cmd" -ArgumentList "/k","cd Client && npm run dev" -WindowStyle Normal
	Start-Sleep -Seconds 5
	Write-Host "Starting Admin Panel (port 3001)..."
	Start-Process -FilePath "cmd" -ArgumentList "/k","cd admin && python -m http.server 3001" -WindowStyle Normal

seed-ml:
	Write-Host "Seeding ML Engine with product embeddings..."
	Write-Host "Starting ML Engine for seeding..."
	Start-Process -FilePath "$(PYTHON)" -ArgumentList "-m","uvicorn","ml_engine.main:app","--host","0.0.0.0","--port","8000" -WindowStyle Normal
	Write-Host "Waiting for ML Engine to load (~45s)..."
	Start-Sleep -Seconds 45
	Write-Host "Starting Go Backend for seed API..."
	Start-Process -FilePath "go" -ArgumentList "run","main.go" -WorkingDirectory "Server" -WindowStyle Normal
	Write-Host "Waiting for backend to connect (~30s)..."
	Start-Sleep -Seconds 30
	Write-Host "Sending seed request..."
	Invoke-RestMethod -Uri "http://localhost:8080/api/admin/seed-ml" -Method POST -TimeoutSec 120 | ConvertTo-Json
	Write-Host "`nSeed started in background. Check: Invoke-RestMethod http://localhost:8000/seed/status"
