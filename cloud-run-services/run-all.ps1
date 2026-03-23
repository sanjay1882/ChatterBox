# run-all.ps1
# This script starts all ChatterBox services in separate PowerShell windows.

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Starting ChatterBox Services...        " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. API Service
Write-Host "[1/4] Launching API Service..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- API SERVICE ---' -ForegroundColor Green; cd '$PSScriptRoot\api-service'; npm start"

# 2. AI Engine Service
Write-Host "[2/4] Launching AI Engine Service..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- AI ENGINE SERVICE ---' -ForegroundColor Green; cd '$PSScriptRoot\ai-engine-service'; .\venv\Scripts\activate; python main.py"

# 3. Browser Worker Service
Write-Host "[3/4] Launching Browser Worker Service on Port 8082..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- BROWSER WORKER SERVICE ---' -ForegroundColor Green; cd '$PSScriptRoot\browser-worker-service'; `$env:PORT='8082'; npm start"

# 4. Frontend Service
Write-Host "[4/4] Launching Frontend Service..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- FRONTEND SERVICE ---' -ForegroundColor Green; cd '$PSScriptRoot\frontend-service'; npm run dev"

Write-Host "`n==========================================" -ForegroundColor Yellow
Write-Host " All services launched successfully!      " -ForegroundColor Yellow
Write-Host " Separate windows have been opened for logs." -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow
