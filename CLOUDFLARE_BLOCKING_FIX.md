# Cloudflare Blocking Issue - Fix Guide

## Problem
The animethemes.moe API is protected by Cloudflare, which is blocking requests from Render.com servers. When you try to access the API through the proxy, Cloudflare returns a 403 error with an HTML page saying "Just a moment...".

## Root Cause
Cloudflare's bot protection detects that requests are coming from a server (Render.com) rather than a real browser, and blocks them. This is a common issue with Cloudflare-protected APIs when accessed from cloud hosting providers.

## Solutions

### Option 1: Contact API Maintainers (Recommended)
Contact the animethemes.moe API maintainers and ask them to:
1. Whitelist Render.com IP addresses
2. Adjust Cloudflare settings to allow server-to-server requests
3. Add an exception for your specific use case

**Where to contact:**
- GitHub: https://github.com/AnimeThemes
- Check their documentation for contact information
- Open an issue explaining your use case

### Option 2: Use a Different Hosting Provider
Some hosting providers might not be blocked by Cloudflare:
- Vercel
- Netlify Functions
- Railway
- Self-hosted VPS (your own IP)

### Option 3: Use a Cloudflare Bypass Service
Services that can bypass Cloudflare (may have costs):
- ScraperAPI
- Bright Data
- Other proxy services

### Option 4: Client-Side Requests (If CORS Allows)
If the API allows CORS from your domain, you could make requests directly from the browser. However, this is unlikely to work if Cloudflare is blocking server requests.

## Current Status
The proxy is now configured to:
- ✅ Use axios with browser-like headers
- ✅ Forward the client's User-Agent
- ✅ Handle Cloudflare challenge detection
- ✅ Return helpful error messages when blocked

## Testing
After deploying, check the logs for:
- `[Proxy] Cloudflare challenge detected!` - This confirms Cloudflare is blocking
- The error message will indicate if it's a Cloudflare block

## Next Steps
1. **Immediate**: Contact animethemes.moe maintainers to request IP whitelisting
2. **Short-term**: Consider using a different hosting provider
3. **Long-term**: If the API maintainers can't help, consider using a Cloudflare bypass service

## Error Messages
If you see these in the logs, it's a Cloudflare block:
- Response contains "Just a moment..."
- Response contains "cf-browser-verification"
- Response contains "challenge-platform"
- Status code 403 or 503 with HTML response

## Why This Happens
Cloudflare uses multiple signals to detect bots:
- IP reputation (cloud hosting IPs are often flagged)
- Request patterns (automated requests look different)
- TLS fingerprinting (server requests have different TLS signatures)
- JavaScript challenges (require browser execution)

Even with perfect browser headers, Cloudflare can still detect server-side requests.

## Workaround (Temporary)
If you need a temporary workaround, you could:
1. Use a VPN or proxy service
2. Run the server from your local machine (not recommended for production)
3. Use a service like ScraperAPI that handles Cloudflare bypass

However, the best long-term solution is to get Render.com IPs whitelisted by the API maintainers.

