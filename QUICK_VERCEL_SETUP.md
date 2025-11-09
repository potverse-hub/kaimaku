# Quick Vercel Setup Guide

## Prerequisites
- GitHub account with your code pushed
- Vercel account (sign up at vercel.com)
- Supabase database (or any PostgreSQL database)

## Quick Deployment Steps

### 1. Deploy to Vercel

**Option A: Via Vercel Dashboard (Recommended)**
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Configure:
   - Framework: Other
   - Root Directory: ./
   - Build Command: (leave empty)
   - Output Directory: (leave empty)

**Option B: Via CLI**
```bash
npm i -g vercel
vercel login
vercel
```

### 2. Set Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables:

```
DATABASE_URL=your_postgresql_connection_string
SESSION_SECRET=generate_random_string_here
NODE_ENV=production
```

**Generate SESSION_SECRET:**
```bash
openssl rand -base64 32
```

### 3. Deploy

Click "Deploy" in Vercel dashboard or run `vercel --prod` if using CLI.

### 4. Verify

Visit your deployment URL (e.g., `https://your-project.vercel.app`) and test:
- Homepage loads
- Search works
- Registration/Login works
- Ratings save correctly

## Important Notes

1. **Database Connection**: Make sure your `DATABASE_URL` includes SSL parameters for Supabase
2. **CORS**: Vercel automatically handles CORS for your domain
3. **Sessions**: Sessions work across serverless function invocations via PostgreSQL
4. **Static Files**: Automatically served by Vercel from root directory

## Troubleshooting

- **Database errors**: Check `DATABASE_URL` and ensure database is accessible
- **Session issues**: Verify `SESSION_SECRET` is set and database session table exists
- **API proxy errors**: Check Vercel function logs in dashboard

For detailed information, see `VERCEL_DEPLOYMENT.md`.

