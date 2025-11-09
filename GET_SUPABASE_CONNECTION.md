# Get Your Supabase Connection String

## Your Supabase Info
- **Project URL**: https://ktaefwoqmaqhzziozfmc.supabase.co
- **Project Ref**: `ktaefwoqmaqhzziozfmc`

## Step-by-Step: Get Connection Pooling String

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard/project/ktaefwoqmaqhzziozfmc
   - Or go to https://supabase.com/dashboard and select your project

2. **Navigate to Database Settings**
   - Click **Settings** (gear icon) in the left sidebar
   - Click **Database** in the settings menu

3. **Get Connection Pooling String**
   - Scroll down to **"Connection string"** section
   - You'll see tabs: **URI**, **JDBC**, **Connection pooling**
   - Click the **"Connection pooling"** tab
   - You'll see options: **Session mode** and **Transaction mode**
   - Select **"Session mode"**
   - Copy the connection string shown

4. **The Connection String Will Look Like:**
   ```
   postgresql://postgres.ktaefwoqmaqhzziozfmc:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
   (The region/endpoint will be different based on where your project is hosted)

5. **Replace Password**
   - Find `[YOUR-PASSWORD]` in the connection string
   - Replace with your password: `Ryan2005:)##`
   - **URL-encode it**: `Ryan2005%3A%29%23%23`
   - So it becomes: `Ryan2005%3A%29%23%23`

6. **Final Connection String:**
   ```
   postgresql://postgres.ktaefwoqmaqhzziozfmc:Ryan2005%3A%29%23%23@[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
   (Replace `[REGION]` with the actual region from your Supabase dashboard)

## Update Render

1. Go to Render dashboard → Your service → Environment
2. Edit `DATABASE_URL`
3. Paste the complete pooled connection string
4. Save

## What to Look For

The key differences in the pooled connection string:
- ✅ Port: `6543` (not 5432)
- ✅ Host: `pooler.supabase.com` (not just `supabase.co`)
- ✅ Username: `postgres.ktaefwoqmaqhzziozfmc` (includes project ref)
- ✅ Has `?pgbouncer=true` at the end

## If You Can't Find Connection Pooling

If connection pooling isn't available:
1. Check if your Supabase project is on the free tier
2. Connection pooling should be available on all tiers
3. Make sure you're looking at Settings → Database (not API settings)

