# Deploying Kaimaku to Vercel

This guide will help you deploy your full-stack Node.js application to Vercel.

## Prerequisites

1. A Vercel account (free tier works)
2. Your repository pushed to GitHub (or GitLab/Bitbucket)
3. A Supabase database (or any PostgreSQL database)
4. Vercel CLI installed (optional, for local testing)

## Step 1: Prepare Your Code

The code is already set up for Vercel with:
- `vercel.json` configuration file
- `api/index.js` serverless function adapter
- Modified `server.js` to work with both traditional servers and Vercel

## Step 2: Install Vercel CLI (Optional)

```bash
npm i -g vercel
```

## Step 3: Deploy via Vercel Dashboard

### Option A: Deploy from GitHub

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Sign in with GitHub

2. **Import Your Repository**
   - Click "New Project"
   - Select your `kaimaku` repository
   - Click "Import"

3. **Configure Project Settings**
   - **Framework Preset**: Other
   - **Root Directory**: ./ (default)
   - **Build Command**: (leave empty - no build step needed)
   - **Output Directory**: (leave empty)
   - **Install Command**: `npm install`

4. **Set Environment Variables**
   Click "Environment Variables" and add:
   
   ```
   DATABASE_URL=your_postgresql_connection_string
   SESSION_SECRET=your_random_secret_key_here
   NODE_ENV=production
   ```
   
   **Important**: 
   - `DATABASE_URL`: Your Supabase PostgreSQL connection string
   - `SESSION_SECRET`: Generate a random string (e.g., `openssl rand -base64 32`)
   - `NODE_ENV`: Set to `production`

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Your app will be available at `https://your-project.vercel.app`

### Option B: Deploy via CLI

1. **Login to Vercel**
   ```bash
   vercel login
   ```

2. **Deploy**
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Link to existing project? No (first time)
   - Project name: kaimaku (or your preferred name)
   - Directory: ./
   - Override settings? No

3. **Set Environment Variables**
   ```bash
   vercel env add DATABASE_URL
   vercel env add SESSION_SECRET
   vercel env add NODE_ENV production
   ```

4. **Redeploy with Environment Variables**
   ```bash
   vercel --prod
   ```

## Step 4: Configure Custom Domain (Optional)

1. Go to your project settings in Vercel
2. Click "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

## Step 5: Verify Deployment

1. **Check API Endpoints**
   - Visit `https://your-project.vercel.app/api/test-animethemes`
   - Should return API test results

2. **Test Authentication**
   - Try registering a new user
   - Try logging in
   - Check if sessions work

3. **Test Database**
   - Create a rating
   - Check if it persists in the database

## Important Notes

### Database Connection Pooling

Vercel uses serverless functions, which means:
- Each function invocation is stateless
- Database connections are reused via connection pooling
- The `pg` library handles connection pooling automatically
- Consider using Supabase connection pooling for better performance

### Session Storage

- Sessions are stored in PostgreSQL via `connect-pg-simple`
- Sessions work across serverless function invocations
- Cookie settings are optimized for Vercel (sameSite: 'none')

### Static Files

- Static files (HTML, CSS, JS, images) are served automatically by Vercel
- No need to configure static file serving in Express
- Files in the root directory are served directly

### CORS Configuration

- CORS is configured to allow your Vercel domain
- If you have a custom domain, add it to `ALLOWED_ORIGINS` environment variable
- Format: `https://your-domain.com,https://www.your-domain.com`

### Environment Variables

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Random secret for session encryption
- `NODE_ENV`: Set to `production`

Optional environment variables:
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins
- `PRODUCTION_URL`: Your production domain URL

## Troubleshooting

### Database Connection Issues

1. **Check DATABASE_URL**
   - Ensure it's correct and includes SSL parameters
   - For Supabase: Use the connection string from Settings → Database

2. **Connection Pooling**
   - Supabase has connection limits
   - Consider using Supabase connection pooling
   - Reduce `max` connections in `database.js` if needed

### Session Issues

1. **Cookies Not Working**
   - Check cookie settings in `server.js`
   - Ensure `secure: true` in production
   - Check `sameSite` setting (should be 'none' for Vercel)

2. **Sessions Not Persisting**
   - Verify PostgreSQL session table exists
   - Check database connection
   - Verify SESSION_SECRET is set

### API Proxy Issues

1. **403 Errors**
   - Check if animethemes.moe API is blocking Vercel IPs
   - Consider using a different proxy service
   - Check server logs in Vercel dashboard

### Build/Deploy Issues

1. **Build Failures**
   - Check Vercel build logs
   - Ensure all dependencies are in `package.json`
   - Verify Node.js version (Vercel uses Node 18.x by default)

2. **Function Timeout**
   - Vercel has a 10-second timeout for Hobby plan
   - Pro plan has 60-second timeout
   - Optimize database queries
   - Consider using Vercel Pro for longer timeouts

## Vercel vs Render

### Vercel Advantages
- ✅ Faster deployments
- ✅ Better CDN integration
- ✅ Automatic HTTPS
- ✅ Preview deployments for PRs
- ✅ Better developer experience

### Vercel Limitations
- ⚠️ Serverless functions (10s timeout on free tier)
- ⚠️ Cold starts (first request can be slow)
- ⚠️ Connection pooling considerations
- ⚠️ No persistent file system

### Render Advantages
- ✅ Traditional server (no timeout limits)
- ✅ Persistent connections
- ✅ Better for long-running processes
- ✅ More predictable performance

## Cost Comparison

### Vercel Free Tier
- ✅ Unlimited deployments
- ✅ 100GB bandwidth
- ✅ Serverless functions (10s timeout)
- ✅ Automatic HTTPS

### Vercel Pro ($20/month)
- ✅ 1TB bandwidth
- ✅ 60s function timeout
- ✅ Team collaboration
- ✅ Advanced analytics

## Next Steps

1. **Monitor Performance**
   - Use Vercel Analytics
   - Monitor database connection pool
   - Check function execution times

2. **Optimize Database**
   - Use connection pooling
   - Add database indexes
   - Optimize queries

3. **Set Up Monitoring**
   - Use Vercel Logs
   - Set up error tracking (Sentry, etc.)
   - Monitor API response times

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Vercel function logs
3. Verify environment variables
4. Test database connection
5. Check Vercel status page

For more help, see:
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Discord](https://vercel.com/discord)
- [Vercel GitHub Discussions](https://github.com/vercel/vercel/discussions)

