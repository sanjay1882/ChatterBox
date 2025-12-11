# Quick Start Guide - After Deployment

## Step 1: Deploy Your Backend Services

Follow the `DEPLOYMENT_GUIDE.md` to deploy:
1. Node.js backend to Render (or your chosen platform)
2. Python scraper to Render (or your chosen platform)

You'll get two URLs like:
- Backend: `https://chatterbox-backend.onrender.com`
- Scraper: `https://chatterbox-scraper.onrender.com`

## Step 2: Update Configuration Files

### Frontend Configuration (`config.js`)

Open `config.js` and update line 11:

```javascript
production: {
    API_URL: 'https://your-backend-url.onrender.com',  // Replace with your actual backend URL
    SCRAPER_URL: 'https://your-scraper-url.onrender.com'  // Not used in frontend, but kept for reference
}
```

### Backend Environment Variables

In your Render dashboard (or deployment platform), add this environment variable:

```
SCRAPER_URL=https://your-scraper-url.onrender.com
```

## Step 3: Redeploy Frontend

```bash
firebase deploy --only hosting
```

## Step 4: Test Your Application

Visit your Firebase URL and test:
- ✅ Login
- ✅ Send messages
- ✅ Web search
- ✅ Session management
- ✅ Share functionality

## Files That Were Updated

✅ `config.js` - Centralized API configuration
✅ `index.js` - All fetch calls now use `getEndpoint()`
✅ `share.html` - Auto-detects environment
✅ `dist/share.html` - Auto-detects environment
✅ `chat-backend/server.js` - Uses `SCRAPER_URL` env variable
✅ `chat-backend/.env.example` - Environment template

## Development vs Production

The configuration automatically detects:
- **localhost** → Uses `http://localhost:3000`
- **Production** → Uses your deployed backend URL

No code changes needed when switching between environments!
