#!/bin/bash

# Deployment Script for Chatterbox on Google Cloud Platform
# Usage: ./deploy.sh [PROJECT_ID] [REGION]

PROJECT_ID=$1
REGION=${2:-"us-central1"} # Default region

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID is required."
  echo "Usage: ./deploy.sh <PROJECT_ID> [REGION]"
  exit 1
fi

echo "=================================================="
echo "Deploying to GCP Project: $PROJECT_ID (Region: $REGION)"
echo "=================================================="

# 1. Enable Services (First time only, safely skipped if enabled)
echo "Ensuring necessary services are enabled..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com --project "$PROJECT_ID"

# 2. Deploy Backend
echo "--------------------------------------------------"
echo "Deploying Backend..."
cd cloud-run-services/api-service
gcloud builds submit --tag "gcr.io/$PROJECT_ID/chatterbox-backend" --project "$PROJECT_ID"
gcloud run deploy chatterbox-backend \
  --image "gcr.io/$PROJECT_ID/chatterbox-backend" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --project "$PROJECT_ID" \
  --set-env-vars="NODE_ENV=production"

# Capture Backend URL
BACKEND_URL=$(gcloud run services describe chatterbox-backend --platform managed --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)')
echo "Backend Deployed at: $BACKEND_URL"
cd ../..

# 3. Deploy Scraper
echo "--------------------------------------------------"
echo "Deploying Scraper..."
cd cloud-run-services/api-service/Python-scripts
gcloud builds submit --tag "gcr.io/$PROJECT_ID/chatterbox-scraper" --project "$PROJECT_ID"
gcloud run deploy chatterbox-scraper \
  --image "gcr.io/$PROJECT_ID/chatterbox-scraper" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --project "$PROJECT_ID"

# Capture Scraper URL
SCRAPER_URL=$(gcloud run services describe chatterbox-scraper --platform managed --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)')
echo "Scraper Deployed at: $SCRAPER_URL"
cd ../../..

echo "--------------------------------------------------"
echo "Updating Backend with Scraper URL..."
# Update Backend with Scraper URL & Frontend URL placeholder (User must update Frontend URL manually later or we assume firebase)
gcloud run services update chatterbox-backend \
  --platform managed \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --set-env-vars="SCRAPER_URL=$SCRAPER_URL"

echo "=================================================="
echo "Deployment Complete!"
echo "Backend URL: $BACKEND_URL"
echo "Scraper URL: $SCRAPER_URL"
echo "--------------------------------------------------"
echo "NEXT STEPS:"
echo "1. Update your 'cloud-run-services/frontend-service/.env' (or build env) to use the Backend URL: $BACKEND_URL"
echo "2. Deploy Frontend to Firebase: firebase deploy --only hosting"
echo "3. After Frontend deploy, update Backend 'FRONTEND_URL' env var:"
echo "   gcloud run services update chatterbox-backend --set-env-vars='FRONTEND_URL=YOUR_FIREBASE_URL'"
echo "=================================================="
