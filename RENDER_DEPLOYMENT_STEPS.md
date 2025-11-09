# Render Deployment Steps

## Step 1: Push Code to GitHub

Your code is already on GitHub. If you made changes, push them:
```bash
git push origin main
```

## Step 2: Create Render Account

1. Go to https://render.com
2. Click "Get Started for Free"
3. Sign up with GitHub (recommended - easiest)
4. Authorize Render to access your GitHub account

## Step 3: Create Web Service

1. In Render dashboard, click **"New +"** button (top right)
2. Select **"Web Service"**
3. Connect your GitHub account if not already connected
4. Select repository: **potverse-hub/kaimaku**
5. Click **"Connect"**

## Step 4: Configure Service

Fill in the configuration:

- **Name**: `kaimaku` (or any name you prefer)
- **Region**: Choose closest to you (e.g., `Oregon (US West)`)
- **Branch**: `main`
- **Root Directory**: (leave empty)
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Select **"Free"**

## Step 5: Add Environment Variables

Click **"Advanced"** to expand advanced options, then add these environment variables:

### Required Variables:

1. **DATABASE_URL**
   - Key: `DATABASE_URL`
   - Value: `postgresql://postgres:Ryan2005%3A)%23%23@ktaefwoqmaqhzziozfmc.supabase.co:5432/postgres`

2. **SESSION_SECRET**
   - Key: `SESSION_SECRET`
   - Value: `d0b0d08b2654f7d989b826814b0a200ea5e461670fc86cb086abc9f9e16fd3f5`

3. **NODE_ENV**
   - Key: `NODE_ENV`
   - Value: `production`

4. **ALLOWED_ORIGINS** (Optional - add after deployment)
   - Key: `ALLOWED_ORIGINS`
   - Value: (leave empty for now, we'll update after deployment)

### How to Add:
1. Click **"Add Environment Variable"**
2. Enter the Key
3. Enter the Value
4. Click **"Add"**
5. Repeat for each variable

## Step 6: Create Service

1. Review your configuration
2. Click **"Create Web Service"**
3. Render will start building your application
4. Wait 5-10 minutes for deployment

## Step 7: Monitor Deployment

1. Watch the **"Logs"** tab for build progress
2. Look for:
   - `✅ Connected to PostgreSQL database`
   - `✅ Database tables initialized`
   - `✅ Using PostgreSQL session store`
   - `✅ Server running at http://localhost:XXXX`

## Step 8: Get Your URL

1. Once deployed, you'll see your service URL at the top
2. It will look like: `https://kaimaku.onrender.com`
3. Copy this URL

## Step 9: Update ALLOWED_ORIGINS

1. Go to your service → **Environment** tab
2. Find `ALLOWED_ORIGINS` variable
3. Click **"Edit"**
4. Set value to your Render URL: `https://kaimaku.onrender.com` (your actual URL)
5. Click **"Save Changes"**
6. Render will automatically redeploy

## Step 10: Test Your Deployment

1. Visit your Render URL
2. Register a new user
3. Search for an anime opening
4. Rate an opening
5. Check Supabase → Table Editor to see your data

## Troubleshooting

### Build Fails
- Check logs for errors
- Make sure all environment variables are set
- Verify `DATABASE_URL` is correct

### Database Connection Error
- Verify `DATABASE_URL` is correct
- Check Supabase project is active
- Make sure password is URL-encoded correctly

### CORS Errors
- Make sure `ALLOWED_ORIGINS` is set to your Render URL
- Check browser console for specific errors

### Sessions Not Working
- Verify `SESSION_SECRET` is set
- Check `NODE_ENV=production`
- Look for "Using PostgreSQL session store" in logs

## Your Environment Variables Summary

```
DATABASE_URL=postgresql://postgres:Ryan2005%3A)%23%23@ktaefwoqmaqhzziozfmc.supabase.co:5432/postgres
SESSION_SECRET=d0b0d08b2654f7d989b826814b0a200ea5e461670fc86cb086abc9f9e16fd3f5
NODE_ENV=production
ALLOWED_ORIGINS=https://your-app-name.onrender.com
```

## Success!

Once deployed, your site will be live at your Render URL! 🎉

You can:
- Share the URL with others
- Start rating openings
- All data persists in Supabase
- No data loss on server restarts

