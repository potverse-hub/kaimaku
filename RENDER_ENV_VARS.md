# Environment Variables for Render Deployment

## Required Environment Variables

When deploying to Render, add these environment variables:

### 1. DATABASE_URL
```
postgresql://postgres:Ryan2005%3A)%23%23@ktaefwoqmaqhzziozfmc.supabase.co:5432/postgres
```
**What it is:** Your Supabase PostgreSQL connection string

### 2. SESSION_SECRET
```
d0b0d08b2654f7d989b826814b0a200ea5e461670fc86cb086abc9f9e16fd3f5
```
**What it is:** Secret key for encrypting user sessions

### 3. NODE_ENV
```
production
```
**What it is:** Tells the app it's running in production mode
- Enables HTTPS cookies
- Enables SSL for database connection
- Optimizes error handling

### 4. ALLOWED_ORIGINS (Optional)
```
https://your-app-name.onrender.com
```
**What it is:** Your Render URL (add this after deployment)
- Prevents CORS errors
- Replace `your-app-name` with your actual Render app name

## How to Add in Render

1. Go to your Render service dashboard
2. Click on **Environment** in the left sidebar
3. Click **Add Environment Variable**
4. Add each variable:
   - Key: `DATABASE_URL`
   - Value: (paste the connection string)
5. Repeat for all variables
6. Click **Save Changes**
7. Render will automatically redeploy

## Summary

| Variable | Value for Render |
|----------|-----------------|
| `DATABASE_URL` | `postgresql://postgres:Ryan2005%3A)%23%23@ktaefwoqmaqhzziozfmc.supabase.co:5432/postgres` |
| `SESSION_SECRET` | `d0b0d08b2654f7d989b826814b0a200ea5e461670fc86cb086abc9f9e16fd3f5` |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://your-app-name.onrender.com` (your actual URL) |

## Local Development (.env file)

For local testing, your `.env` file should have:
```
NODE_ENV=development
```

This is already set up in your `.env` file for local development.

