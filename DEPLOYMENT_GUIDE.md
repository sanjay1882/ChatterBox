# ChatterBox GCP Deployment Guide

This guide details how to deploy your **Chatterbox** application to Google Cloud Platform (GCP).

## Architecture Overview
- **Frontend**: Deployed to **Firebase Hosting** (Global CDN).
- **Backend**: Containerized Node.js service on **Cloud Run**.
- **Scraper**: Containerized Python service on **Cloud Run**.

---

## Prerequisites
1. **GCP Project**: Create a project in the [Google Cloud Console](https://console.cloud.google.com/) and enable billing.
2. **Tools**:
   - `gcloud` CLI installed and authenticated (`gcloud auth login`).
   - `firebase` CLI installed (`npm install -g firebase-tools`).
3. **Billing**: Cloud Run requires billing to be enabled (though it has a generous free tier).

---

## Step 1: Backend & Scraper Deployment (Cloud Run)

We have automated this with the `deploy.sh` script.

1. **Open your terminal** (e.g., Git Bash or VS Code terminal).
2. **Login to GCP** (if not done):
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
3. **Run the deployment script**:
   ```bash
   ./deploy.sh YOUR_PROJECT_ID
   # Example: ./deploy.sh my-chatterbox-project
   ```
4. **Wait for completion**:
   - The script will build your Docker images, push them to Google Container Registry, and deploy them to Cloud Run.
   - It will output two critical URLs at the end:
     - **Backend URL**: `https://chatterbox-backend-xxxxx-uc.a.run.app`
     - **Scraper URL**: `https://chatterbox-scraper-xxxxx-uc.a.run.app`

---

## Step 2: Frontend Deployment (Firebase Hosting)

1. **Update Config**:
   - Open `e:\chatterbox\frontend\config.js`.
   - Ensure it's reading from environment variables or update the fallback:
     ```javascript
     export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "https://YOUR_BACKEND_URL_FROM_STEP_1";
     ```
   - *Better approach*: Set the env var in your build process or `.env.production`.

2. **Deploy**:
   ```bash
   firebase deploy --only hosting
   ```
3. **Note the Hosting URL**: Firebase will output your app's public URL (e.g., `https://your-project.web.app`).

---

## Step 3: Final Configuration (Connecting the dots)

1. **Update Backend with Frontend URL (GCP)**:
   - Your backend needs to know the Frontend URL to allow CORS (security).
   - Run this command (replace with your actual Firebase URL):
     ```bash
     gcloud run services update chatterbox-backend \
       --platform managed \
       --region us-central1 \
       --set-env-vars="FRONTEND_URL=https://your-project.web.app"
     ```

2. **Update Environment Variables**:
   - Ensure your Backend Cloud Run service has all other needed secrets (`MONGO_URI`, `GEMINI_API_KEY`, etc.) set in the "Variables & Secrets" tab of the Cloud Run Console.

---

## Troubleshooting
- **500 Errors**: Check Cloud Run logs in the GCP Console.
- **CORS Errors**: Ensure `FRONTEND_URL` is set correctly on the Backend service.
