# ChatterBox Backend Deployment Guide

This guide will help you deploy your Node.js backend and Python scraper to Render (free tier).

## Prerequisites

- GitHub account
- Render account (sign up at https://render.com)
- Your environment variables ready:
  - `GEMINI_API_KEY`
  - `MONGO_URI`
  - `API_KEY_SE`
  - `CX_ID`

---

## Step 1: Prepare Your Repository

1. **Push your code to GitHub** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

---

## Step 2: Deploy Node.js Backend to Render

### 2.1 Create Web Service

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `chatterbox-backend` (or any name you prefer)
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `chat-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`

### 2.2 Add Environment Variables

In the "Environment" section, add:
- `GEMINI_API_KEY` = your_gemini_api_key
- `MONGO_URI` = your_mongodb_connection_string
- `PORT` = 3000

### 2.3 Deploy

1. Click **"Create Web Service"**
2. Wait for deployment to complete (5-10 minutes)
3. **Copy your deployment URL** (e.g., `https://chatterbox-backend.onrender.com`)

---

## Step 3: Deploy Python Scraper to Render

### 3.1 Create Another Web Service

1. Click **"New +"** → **"Web Service"**
2. Select the same GitHub repository
3. Configure the service:
   - **Name**: `chatterbox-scraper`
   - **Region**: Same as backend
   - **Branch**: `main`
   - **Root Directory**: `chat-backend/Python-scripts`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python scraper.py`
   - **Instance Type**: `Free`

### 3.2 Create requirements.txt

If you don't have a `requirements.txt` file in `chat-backend/Python-scripts/`, create one:

```txt
flask==3.0.0
flask-cors==4.0.0
python-dotenv==1.0.0
requests==2.31.0
beautifulsoup4==4.12.2
```

### 3.3 Add Environment Variables

In the "Environment" section, add:
- `API_KEY_SE` = your_google_custom_search_api_key
- `CX_ID` = your_custom_search_engine_id
- `PORT` = 3001

### 3.4 Deploy

1. Click **"Create Web Service"**
2. Wait for deployment to complete
3. **Copy your deployment URL** (e.g., `https://chatterbox-scraper.onrender.com`)

---

## Step 4: Update Configuration

### 4.1 Update Frontend Configuration

Open `config.js` and update the production URLs:

```javascript
production: {
    API_URL: 'https://chatterbox-backend.onrender.com',  // Your Node.js backend URL
    SCRAPER_URL: 'https://chatterbox-scraper.onrender.com'  // Your Python scraper URL
}
```

### 4.2 Update Backend Configuration

Open `chat-backend/.env` and add:

```env
SCRAPER_URL=https://chatterbox-scraper.onrender.com
```

Then update `server.js` line 161 to use the environment variable.

---

## Step 5: Redeploy Frontend to Firebase

```bash
firebase deploy --only hosting
```

---

## Step 6: Test Your Application

1. Visit your Firebase URL
2. Test the following:
   - ✅ User login
   - ✅ Send a message
   - ✅ Web search functionality
   - ✅ Session management
   - ✅ Share functionality

---

## Troubleshooting

### Backend not responding
- Check Render logs: Dashboard → Your Service → Logs
- Verify environment variables are set correctly
- Check if MongoDB is accessible from Render

### CORS errors
- Ensure your backend has CORS enabled for your Firebase domain
- Update CORS configuration in `server.js` if needed

### Free tier limitations
- Render free tier spins down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- Consider upgrading to paid tier for production use

---

## Alternative: Quick Test with Render URLs

If you just want to test quickly, I can update your code to use placeholder URLs, and you can replace them after deployment.

**Next Steps:**
1. Follow this guide to deploy
2. Update `config.js` with your deployment URLs
3. Redeploy to Firebase
