# Fixing Supabase Database Connection Timeout

## The Problem

Your site is live but can't connect to Supabase database. This is usually because:

1. **Connection Pooling**: Supabase requires using connection pooling for external connections
2. **IP Restrictions**: Supabase might be blocking Render's IP addresses
3. **Connection String Format**: Need to use the pooled connection string

## Solution: Use Supabase Connection Pooling

### Step 1: Get the Pooled Connection String

1. Go to your Supabase project dashboard
2. Click **Settings** → **Database**
3. Scroll to **Connection string** section
4. Click the **"Connection pooling"** tab (NOT the URI tab)
5. Select **"Session mode"** or **"Transaction mode"**
6. Copy the connection string (it will have a different port, usually 6543 or 5432)

The pooled connection string looks like:
```
postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Step 2: Update Render Environment Variable

1. Go to your Render service dashboard
2. Click **Environment** tab
3. Find `DATABASE_URL`
4. Click **Edit**
5. Replace with the pooled connection string from Step 1
6. Make sure to replace `[YOUR-PASSWORD]` with your actual password (URL-encoded)
7. Click **Save Changes**
8. Render will automatically redeploy

### Step 3: Alternative - Check IP Restrictions

If connection pooling doesn't work:

1. Go to Supabase → **Settings** → **Database**
2. Scroll to **Connection Pooling**
3. Check if there are IP restrictions
4. If yes, add Render's IP ranges or disable restrictions temporarily

## Quick Fix: Use Direct Connection (Temporary)

If pooling doesn't work, try the direct connection:

1. In Supabase → Settings → Database
2. Get the **URI** connection string (not pooled)
3. Make sure it uses port **5432** (not 6543)
4. Update `DATABASE_URL` in Render

## Password Encoding Reminder

Your password `Ryan2005:)##` needs to be URL-encoded:
- `:` = `%3A`
- `)` = `%29`
- `#` = `%23`

So it becomes: `Ryan2005%3A%29%23%23`

## Test Connection

After updating, check Render logs. You should see:
- `✅ Database connection successful`
- `✅ Database tables initialized successfully`

If you still see timeouts, the issue might be:
- Supabase project is paused (check dashboard)
- Network firewall blocking connections
- Incorrect password encoding

