# API 403 Error - Troubleshooting Guide

## Problem
The application is receiving 403 (Forbidden) errors when trying to access the animethemes.moe API through the proxy endpoint on Render.

## Root Cause
The animethemes.moe API is likely blocking requests from Render's IP addresses. This is a common anti-abuse measure used by APIs to prevent scraping from cloud hosting providers.

## Solutions

### Option 1: Contact API Maintainers (Recommended)
1. Reach out to the animethemes.moe API maintainers
2. Request IP whitelisting for your Render service
3. Provide your Render service URL and explain your use case
4. API contact: Check their GitHub repository or documentation

### Option 2: Use Client-Side Requests (If CORS Allows)
If the API allows CORS from your domain, you can make requests directly from the browser:
- Modify `script.js` to use the API directly in production
- This bypasses the server proxy entirely
- Check if `https://api.animethemes.moe` allows CORS for your domain

### Option 3: Use a Different Hosting Provider
Some hosting providers may not be blocked:
- Vercel
- Netlify Functions
- Railway
- Self-hosted VPS

### Option 4: Use a Proxy Service
Use a third-party proxy service (may also be blocked):
- CORS Anywhere (requires self-hosting)
- Other proxy services

### Option 5: Test the API Connectivity
1. Deploy the updated code to Render
2. Visit: `https://kaimaku.onrender.com/api/test-animethemes`
3. Check the response to see the exact error from the API
4. This will help diagnose if it's an IP block or another issue

## Immediate Steps

1. **Test the API endpoint:**
   ```
   Visit: https://kaimaku.onrender.com/api/test-animethemes
   ```
   This will show you the exact response from the animethemes.moe API.

2. **Check Render logs:**
   - Go to your Render dashboard
   - Check the logs for `[Proxy]` messages
   - Look for the actual error response from the API

3. **Verify API is accessible:**
   - Test the API directly: `https://api.animethemes.moe/anime?page[size]=1`
   - This should work from your browser
   - If it works in browser but not from Render, it's an IP block

## Updated Proxy Features

The proxy has been updated with:
- ✅ Gzip/deflate/brotli decompression support
- ✅ Better error logging
- ✅ Minimal headers (as per API docs)
- ✅ Test endpoint for debugging
- ✅ Improved error messages

## Next Steps

1. Deploy the updated code
2. Test the `/api/test-animethemes` endpoint
3. Check the response to determine the exact issue
4. Contact API maintainers if it's an IP block
5. Consider alternative hosting if blocking persists

## API Documentation
- API Docs: https://api-docs.animethemes.moe
- Rate Limit: 90 requests per minute
- Authentication: Not required for GET requests

