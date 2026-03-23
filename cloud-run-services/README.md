# ChatterBox Services Orchestrator

This directory contains the various services that make up the ChatterBox application.

## Quick Start (All Services)

You can run all services with a single command using one of the two methods below:

### Method 1: Using NPM (Single Terminal)
This method runs all services in one terminal window, prefixing logs with the service name.
```powershell
npm start
```
*Requires `concurrently` (installed automatically via `npm install` in this directory).*

### Method 2: Using PowerShell (Separate Windows)
This method opens a new PowerShell window for each service, which is better for reading individual logs.
```powershell
.\run-all.ps1
```

## Services Included:
1. **API Service** (Port 3000)
2. **AI Engine Service** (Port 8000)
3. **Browser Worker Service** (Port 8082)
4. **Frontend Service** (Port 5173 / Vite Default)

## Individual Manual Start Commands:

### API Service
```powershell
cd api-service
npm start
```

### AI Engine Service
```powershell
cd ai-engine-service
.\venv\Scripts\activate
python main.py
```

### Browser Worker Service
```powershell
cd browser-worker-service
$env:PORT="8082"
npm start
```

### Frontend Service
```powershell
cd frontend-service
npm run dev
```
