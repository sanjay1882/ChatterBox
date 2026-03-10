@echo off
SETLOCAL

REM ======================================================
REM  Chatterbox Deployment Script -- Windows (GCP)
REM  Usage: deploy.bat <PROJECT_ID> [REGION]
REM
REM  BEFORE RUNNING: Set these environment variables:
REM    set GEMINI_API_KEY=your_key
REM    set ANTHROPIC_API_KEY=your_key
REM    set GROQ_API_KEY=your_key
REM    set TAVILY_API_KEY=your_key
REM    set API_KEY_SE=your_key
REM    set CX_ID=your_cx_id
REM    set MONGO_URI=your_mongo_uri
REM    set FRONTEND_URL=https://treevit.web.app
REM
REM  NEVER hardcode secrets in this file.
REM  Store them in backend/.env (gitignored) for local use.
REM ======================================================

SET PROJECT_ID=%1
SET REGION=%2

IF "%PROJECT_ID%"=="" (
    ECHO Error: PROJECT_ID is required.
    ECHO Usage: deploy.bat ^<PROJECT_ID^> [REGION]
    EXIT /B 1
)

REM Validate required secrets are set
IF "%GEMINI_API_KEY%"=="" (ECHO ERROR: GEMINI_API_KEY env var not set & EXIT /B 1)
IF "%ANTHROPIC_API_KEY%"=="" (ECHO ERROR: ANTHROPIC_API_KEY env var not set & EXIT /B 1)
IF "%GROQ_API_KEY%"=="" (ECHO ERROR: GROQ_API_KEY env var not set & EXIT /B 1)
IF "%MONGO_URI%"=="" (ECHO ERROR: MONGO_URI env var not set & EXIT /B 1)

IF "%REGION%"=="" SET REGION=us-central1

ECHO ==================================================
ECHO Deploying to GCP Project: %PROJECT_ID% (Region: %REGION%)
ECHO ==================================================

REM 1. Enable Services
ECHO Ensuring necessary services are enabled...
call gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com --project "%PROJECT_ID%"

REM 2. Deploy Backend (Build Docker image and push to Cloud Run)
ECHO --------------------------------------------------
ECHO Deploying Backend...
cd cloud-run-services\api-service
call gcloud builds submit --tag "gcr.io/%PROJECT_ID%/chatterbox-backend" --project "%PROJECT_ID%"
call gcloud run deploy chatterbox-backend ^
  --image "gcr.io/%PROJECT_ID%/chatterbox-backend" ^
  --platform managed ^
  --region "%REGION%" ^
  --allow-unauthenticated ^
  --project "%PROJECT_ID%" ^
  --set-env-vars="NODE_ENV=production,GEMINI_API_KEY=%GEMINI_API_KEY%,MONGO_URI=%MONGO_URI%,ANTHROPIC_API_KEY=%ANTHROPIC_API_KEY%,GROQ_API_KEY=%GROQ_API_KEY%,TAVILY_API_KEY=%TAVILY_API_KEY%,API_KEY_SE=%API_KEY_SE%,CX_ID=%CX_ID%,FRONTEND_URL=%FRONTEND_URL%"

REM Capture Backend URL
FOR /F "tokens=*" %%i IN ('call gcloud run services describe chatterbox-backend --platform managed --region "%REGION%" --project "%PROJECT_ID%" --format "value(status.url)"') DO SET BACKEND_URL=%%i
ECHO Backend Deployed at: %BACKEND_URL%
cd ..\..

ECHO ==================================================
ECHO Deployment Complete!
ECHO Backend URL: %BACKEND_URL%
ECHO --------------------------------------------------
ECHO NEXT STEPS:
ECHO 1. Frontend live at: https://treevit.web.app
ECHO 2. If backend URL changed, update cloud-run-services\frontend-service\.env
ECHO 3. Run: firebase deploy --only hosting
ECHO ==================================================
ENDLOCAL
