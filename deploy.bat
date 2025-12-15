@echo off
SETLOCAL

REM Deployment Script for Chatterbox on Google Cloud Platform (Windows)
REM Usage: deploy.bat [PROJECT_ID] [REGION]

SET PROJECT_ID=%1
SET REGION=%2

IF "%PROJECT_ID%"=="" (
    ECHO Error: PROJECT_ID is required.
    ECHO Usage: deploy.bat ^<PROJECT_ID^> [REGION]
    EXIT /B 1
)

IF "%REGION%"=="" SET REGION=us-central1

ECHO ==================================================
ECHO Deploying to GCP Project: %PROJECT_ID% (Region: %REGION%)
ECHO ==================================================

REM 1. Enable Services
ECHO Ensuring necessary services are enabled...
call gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com --project "%PROJECT_ID%"

REM 2. Deploy Backend
ECHO --------------------------------------------------
ECHO Deploying Backend...
cd backend
call gcloud builds submit --tag "gcr.io/%PROJECT_ID%/chatterbox-backend" --project "%PROJECT_ID%"
call gcloud run deploy chatterbox-backend ^
  --image "gcr.io/%PROJECT_ID%/chatterbox-backend" ^
  --platform managed ^
  --region "%REGION%" ^
  --allow-unauthenticated ^
  --project "%PROJECT_ID%" ^
  --set-env-vars="NODE_ENV=production"

REM Capture Backend URL
FOR /F "tokens=*" %%i IN ('call gcloud run services describe chatterbox-backend --platform managed --region "%REGION%" --project "%PROJECT_ID%" --format "value(status.url)"') DO SET BACKEND_URL=%%i
ECHO Backend Deployed at: %BACKEND_URL%
cd ..

REM 3. Deploy Scraper
ECHO --------------------------------------------------
ECHO Deploying Scraper...
cd backend/Python-scripts
call gcloud builds submit --tag "gcr.io/%PROJECT_ID%/chatterbox-scraper" --project "%PROJECT_ID%"
call gcloud run deploy chatterbox-scraper ^
  --image "gcr.io/%PROJECT_ID%/chatterbox-scraper" ^
  --platform managed ^
  --region "%REGION%" ^
  --allow-unauthenticated ^
  --project "%PROJECT_ID%"

REM Capture Scraper URL
FOR /F "tokens=*" %%i IN ('call gcloud run services describe chatterbox-scraper --platform managed --region "%REGION%" --project "%PROJECT_ID%" --format "value(status.url)"') DO SET SCRAPER_URL=%%i
ECHO Scraper Deployed at: %SCRAPER_URL%
cd ../..

ECHO --------------------------------------------------
ECHO Updating Backend with Scraper URL...
call gcloud run services update chatterbox-backend ^
  --platform managed ^
  --region "%REGION%" ^
  --project "%PROJECT_ID%" ^
  --set-env-vars="SCRAPER_URL=%SCRAPER_URL%"

ECHO ==================================================
ECHO Deployment Complete!
ECHO Backend URL: %BACKEND_URL%
ECHO Scraper URL: %SCRAPER_URL%
ECHO --------------------------------------------------
ECHO NEXT STEPS:
ECHO 1. Update 'frontend/config.js' to use Backend URL: %BACKEND_URL%
ECHO 2. Deploy Frontend to Firebase: firebase deploy --only hosting
ECHO 3. Update Backend with Frontend URL:
ECHO    gcloud run services update chatterbox-backend --set-env-vars="FRONTEND_URL=YOUR_FIREBASE_URL"
ECHO ==================================================
ENDLOCAL
