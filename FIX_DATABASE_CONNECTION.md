# Fix Database Connection Timeout

## Your Site is Live! 🎉
**URL**: https://kaimaku.onrender.com

But the database connection is timing out. Here's how to fix it:

## The Problem

Supabase blocks direct connections from external services. You need to use **Connection Pooling**.

## Solution: Use Supabase Connection Pooling

### Step 1: Get Pooled Connection String

1. Go to your Supabase project: https://supabase.com/dashboard/project/ktaefwoqmaqhzziozfmc
2. Click **Settings** (gear icon) → **Database**
3. Scroll to **Connection string** section
4. Click the **"Connection pooling"** tab (NOT "URI")
5. Select **"Session mode"**
6. Copy the connection string

It will look like:
```
postgresql://postgres.ktaefwoqmaqhzziozfmc:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Step 2: Update Password in Connection String

Replace `[YOUR-PASSWORD]` with your actual password, URL-encoded:
- Your password: `Ryan2005:)##`
- URL-encoded: `Ryan2005%3A%29%23%23`

So the full connection string should be:
```
postgresql://postgres.ktaefwoqmaqhzziozfmc:Ryan2005%3A%29%23%23@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Note**: The host will be different (pooler.supabase.com) and port will be 6543 (not 5432)

### Step 3: Update Render Environment Variable

1. Go to https://dashboard.render.com
2. Click on your `kaimaku` service
3. Click **Environment** tab
4. Find `DATABASE_URL`
5. Click **Edit**
6. Replace with the pooled connection string from Step 2
7. Click **Save Changes**
8. Render will automatically redeploy

### Step 4: Verify

After redeploy, check the logs. You should see:
- `✅ Database connection successful`
- `✅ Database tables initialized successfully`

## Alternative: Check Supabase IP Restrictions

If pooling still doesn't work:

1. Go to Supabase → Settings → Database
2. Check **"Connection Pooling"** settings
3. Make sure there are no IP restrictions
4. If there are, either:
   - Add Render's IP ranges
   - Or disable restrictions (for free tier testing)

## Quick Test

After updating, visit your site:
- https://kaimaku.onrender.com
- Try to register a user
- If it works, check Supabase → Table Editor → `users` table
- You should see your user!

## Your Current Connection String (Direct - Not Working)

```
postgresql://postgres:Ryan2005%3A%29%23%23@ktaefwoqmaqhzziozfmc.supabase.co:5432/postgres
```

## Your New Connection String (Pooled - Should Work)

```
postgresql://postgres.ktaefwoqmaqhzziozfmc:Ryan2005%3A%29%23%23@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

(Get the exact one from Supabase dashboard - the host/region will be different)

