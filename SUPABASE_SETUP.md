# PostgreSQL Setup with Supabase (FREE)

## Why PostgreSQL?

✅ **Persistent storage** - Data survives server restarts  
✅ **Free tier** - Supabase offers 500MB database free forever  
✅ **Reliable** - Industry-standard database  
✅ **Scalable** - Can handle millions of ratings  
✅ **Works with Render free tier** - No persistent disk needed!

## Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub (free)
4. Click "New Project"

## Step 2: Create Project

1. **Organization**: Create new or use existing
2. **Name**: `kaimaku` (or any name)
3. **Database Password**: Create a strong password (save it!)
4. **Region**: Choose closest to you
5. **Pricing Plan**: Free
6. Click "Create new project"
7. Wait 2-3 minutes for setup

## Step 3: Get Database URL

1. In your Supabase project, go to **Settings** → **Database**
2. Scroll down to **Connection string**
3. Click **URI** tab
4. Copy the connection string (looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`)
5. **Replace `[YOUR-PASSWORD]`** with your actual database password
6. This is your `DATABASE_URL`

Example:
```
postgresql://postgres:mypassword123@db.abcdefghijklmnop.supabase.co:5432/postgres
```

## Step 4: Deploy to Render

1. Go to https://render.com
2. Create new Web Service
3. Connect your GitHub repo: `potverse-hub/kaimaku`
4. Configure:
   - **Name**: `kaimaku`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

5. **Add Environment Variables**:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = (paste your Supabase connection string)
   - `SESSION_SECRET` = (generate: `openssl rand -hex 32`)
   - `ALLOWED_ORIGINS` = (leave empty for now, update after deployment)

6. Click "Create Web Service"

## Step 5: Test

1. Wait for deployment (~5 minutes)
2. Visit your Render URL
3. Register a user
4. Rate an opening
5. Check Supabase dashboard → Table Editor → `ratings` table
6. You should see your rating! ✅

## Database Schema

The database automatically creates these tables:

- **users**: Stores user accounts
  - `username` (primary key)
  - `password_hash`
  - `created_at`

- **ratings**: Stores all ratings
  - `id` (auto-increment)
  - `theme_id`
  - `user_id`
  - `rating` (0-10)
  - `anime_name`
  - `anime_slug`
  - `theme_sequence`
  - `timestamp`

## Viewing Data

1. Go to Supabase dashboard
2. Click **Table Editor**
3. View `users` and `ratings` tables
4. All your data is there! 🎉

## Local Development

For local development, you can:

1. Use the same Supabase database (recommended)
2. Or create a local PostgreSQL database
3. Set `DATABASE_URL` environment variable

Example `.env` file:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/kaimaku
NODE_ENV=development
SESSION_SECRET=your-secret-key
```

## Troubleshooting

**Error: "connection refused"**
- Check your `DATABASE_URL` is correct
- Make sure password doesn't have special characters that need encoding
- Check Supabase project is active

**Error: "relation does not exist"**
- Tables are created automatically on first startup
- Check server logs for initialization messages

**Error: "SSL required"**
- Supabase requires SSL in production
- The code handles this automatically

## Benefits

✅ **Free forever** - 500MB is plenty for thousands of ratings  
✅ **No data loss** - Data persists even if Render restarts  
✅ **Fast queries** - PostgreSQL is optimized for this  
✅ **Easy to scale** - Upgrade Supabase plan if needed  

## Next Steps

1. Set up Supabase (5 minutes)
2. Get `DATABASE_URL`
3. Deploy to Render with `DATABASE_URL` environment variable
4. Done! Your site is live with persistent storage! 🚀

