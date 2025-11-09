# Free Hosting Guide for Kaimaku

## Option 1: Render (Recommended - Easiest) ⭐

### Steps:

1. **Create a GitHub repository** (if you haven't already)
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/kaimaku.git
   git push -u origin main
   ```

2. **Sign up for Render**
   - Go to https://render.com
   - Sign up with GitHub (free)

3. **Create a New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository

4. **Configure the service:**
   - **Name**: kaimaku (or any name)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. **Add Environment Variables:**
   - `NODE_ENV`: `production`
   - `SESSION_SECRET`: Generate a random string (use: `openssl rand -hex 32`)
   - `ALLOWED_ORIGINS`: Your Render URL (e.g., `https://kaimaku.onrender.com`)

6. **Deploy!**
   - Click "Create Web Service"
   - Render will build and deploy automatically
   - Your site will be live at: `https://kaimaku.onrender.com`

### Notes:
- Free tier includes 750 hours/month (enough for always-on)
- May spin down after 15 minutes of inactivity (first request will be slower)
- Storage is persistent (ratings.json and users.json are saved)

---

## Option 2: Railway (Alternative)

### Steps:

1. **Sign up for Railway**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure:**
   - Railway auto-detects Node.js
   - Add environment variable: `PORT` = `${{PORT}}` (Railway sets this automatically)

4. **Add Environment Variables:**
   - `NODE_ENV`: `production`
   - `SESSION_SECRET`: Generate random string
   - `ALLOWED_ORIGINS`: Your Railway URL

5. **Deploy!**
   - Railway auto-deploys on git push
   - Get your URL from Railway dashboard

### Notes:
- Free tier: $5 credit/month (usually enough for small sites)
- No cold starts
- Persistent storage

---

## Option 3: Netlify + Vercel Functions (Advanced)

This requires converting to serverless functions and using a database. Recommended databases:
- **Supabase** (PostgreSQL, free tier)
- **MongoDB Atlas** (free tier)
- **PlanetScale** (MySQL, free tier)

This is more complex but offers better scalability.

---

## Quick Start with Render:

1. Push code to GitHub
2. Sign up at render.com
3. Create Web Service
4. Connect GitHub repo
5. Set environment variables
6. Deploy!

Your site will be live in ~5 minutes! 🚀

## Important Notes:

- **Change SESSION_SECRET**: Use a random string in production
- **CORS**: Update `ALLOWED_ORIGINS` with your production URL
- **HTTPS**: Render/Railway provide HTTPS automatically
- **Storage**: File storage works on Render/Railway (persistent disks)

## Troubleshooting:

- **CORS errors**: Make sure `ALLOWED_ORIGINS` includes your production URL
- **Session not working**: Ensure `SESSION_SECRET` is set and cookies are enabled
- **Cold starts**: First request after inactivity may be slow (Render free tier)

