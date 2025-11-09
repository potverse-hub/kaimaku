# Quick Start Guide - Supabase to Render

## Step 1: Get Your Database URL from Supabase ✅

1. In your Supabase project dashboard, click **Settings** (gear icon) in the left sidebar
2. Click **Database** in the settings menu
3. Scroll down to **Connection string** section
4. Click the **URI** tab
5. You'll see a connection string like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
6. **Copy this connection string**
7. **Replace `[YOUR-PASSWORD]`** with your actual database password
   - You set this when creating the project
   - If you forgot it, go to Settings → Database → Reset database password
8. Your final `DATABASE_URL` should look like:
   ```
   postgresql://postgres:your-actual-password@db.xxxxx.supabase.co:5432/postgres
   ```

## Step 2: Deploy to Render

### Option A: Deploy Now (Recommended)

1. Go to https://render.com
2. Sign up/Login with GitHub
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub account if not already connected
5. Select repository: **potverse-hub/kaimaku**
6. Configure the service:
   - **Name**: `kaimaku` (or any name you want)
   - **Environment**: `Node`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: (leave empty)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
7. Click **"Advanced"** to add environment variables
8. Add these environment variables:
   - **Key**: `DATABASE_URL`
     **Value**: (paste your Supabase connection string from Step 1)
   - **Key**: `SESSION_SECRET`
     **Value**: (generate a random string, e.g., `openssl rand -hex 32` or just use any long random string)
   - **Key**: `NODE_ENV`
     **Value**: `production`
   - **Key**: `ALLOWED_ORIGINS`
     **Value**: (leave empty for now, we'll update after deployment)
9. Click **"Create Web Service"**
10. Wait 5-10 minutes for deployment
11. Once deployed, you'll get a URL like: `https://kaimaku.onrender.com`
12. Update `ALLOWED_ORIGINS` environment variable with your Render URL:
    - Go to your Render service → Environment
    - Edit `ALLOWED_ORIGINS` = `https://kaimaku.onrender.com` (your actual URL)
    - Save changes (this will trigger a redeploy)

### Option B: Test Locally First

1. Create a `.env` file in your project root:
   ```env
   DATABASE_URL=postgresql://postgres:your-password@db.xxxxx.supabase.co:5432/postgres
   SESSION_SECRET=your-random-secret-key-here
   NODE_ENV=development
   ```
2. Install dependencies (if not already):
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open http://localhost:3000
5. Test registration and rating
6. Check Supabase dashboard → Table Editor to see your data

## Step 3: Verify Database Setup

1. Go to your Supabase project dashboard
2. Click **Table Editor** in the left sidebar
3. You should see two tables:
   - `users` - Stores user accounts
   - `ratings` - Stores all ratings
4. If tables don't exist yet, they will be created automatically when the server starts for the first time

## Step 4: Test Your Deployment

1. Visit your Render URL (e.g., `https://kaimaku.onrender.com`)
2. Register a new user account
3. Search for an anime opening
4. Rate an opening
5. Check Supabase Table Editor → `ratings` table
6. You should see your rating! ✅

## Troubleshooting

### "DATABASE_URL not set" error
- Make sure you added the `DATABASE_URL` environment variable in Render
- Check that the connection string is correct (no extra spaces)
- Make sure password is replaced (not `[YOUR-PASSWORD]`)

### "Connection refused" error
- Check your Supabase project is active (not paused)
- Verify the connection string is correct
- Make sure password doesn't have special characters that need URL encoding

### Tables don't exist
- Tables are created automatically on first server start
- Check Render logs for initialization messages
- Look for "✅ Database tables initialized" in logs

### CORS errors
- Make sure `ALLOWED_ORIGINS` is set to your Render URL
- Format: `https://your-app.onrender.com` (no trailing slash)

## Next Steps

Once deployed:
1. Your site is live! 🎉
2. Share the URL with others
3. Start rating openings!
4. Check Supabase dashboard to see all ratings

## Need Help?

- Check Render logs: Your service → Logs
- Check Supabase logs: Settings → Database → Connection pooling
- Verify environment variables are set correctly
- Make sure database password is correct

