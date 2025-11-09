# CORS Fix for Mobile Devices

## Problem
Mobile devices were experiencing CORS errors when trying to access the animethemes.moe API, even though the site worked perfectly on desktop/laptop.

## Root Cause
1. **Mobile browsers enforce CORS more strictly** than desktop browsers
2. **Direct API access from mobile browsers** causes CORS errors because the API doesn't allow cross-origin requests from browsers
3. **Fallback to direct API** was being attempted on mobile, which always fails due to CORS
4. **CORS headers** weren't being set properly on all proxy responses (including errors)

## Solution

### 1. Always Use Proxy on Mobile
- **Mobile devices NEVER try direct API** - they always use the proxy endpoint
- The proxy makes server-side requests (no CORS restrictions)
- Mobile browsers only communicate with your server (same origin, no CORS issues)

### 2. Improved CORS Headers
- **CORS headers set FIRST** in the proxy endpoint (before any processing)
- **CORS headers on ALL responses** including errors (important for mobile)
- **OPTIONS preflight handler** added for mobile browser compatibility
- **Permissive CORS policy** for the proxy endpoint (allows any origin)

### 3. Better Error Handling
- Errors from proxy still include CORS headers
- Mobile browsers can read error messages properly
- No CORS errors from the proxy itself

### 4. Enhanced Server Configuration
- **Flexible origin matching** - handles http/https variations
- **Subdomain support** - allows variations of your domain
- **Automatic Render URL handling** - adds both http and https versions

## Key Changes

### Server-Side (`server.js`)
1. **CORS Configuration**:
   - More permissive origin checking
   - Allows proxy access from any origin
   - Handles http/https variations automatically

2. **OPTIONS Handler**:
   - Handles CORS preflight requests
   - Required for some mobile browsers
   - Returns proper CORS headers

3. **Proxy Endpoint**:
   - Sets CORS headers FIRST (before processing)
   - Sets CORS headers on ALL responses (including errors)
   - Better error handling with CORS support

### Client-Side (`script.js`)
1. **Mobile Detection**:
   - Detects mobile devices
   - Logs detection for debugging
   - Prevents direct API usage on mobile

2. **Fetch Function**:
   - On mobile: NEVER tries direct API
   - On desktop: May try direct API if proxy fails
   - Always uses proxy on mobile devices

3. **API Base URL**:
   - Mobile: Always uses proxy (`API_BASE`)
   - Desktop: May use direct API if proxy is blocked
   - All API calls respect mobile detection

## How It Works

### Desktop Flow
1. Try proxy endpoint
2. If proxy returns 403, try direct API (CORS may work on desktop)
3. Use whichever works

### Mobile Flow
1. Always use proxy endpoint
2. Never try direct API (would cause CORS errors)
3. Proxy makes server-side request (no CORS)
4. Proxy returns data with CORS headers

## Testing

### Test on Mobile
1. Open the site on your mobile device
2. Check browser console for: `[Mobile] Mobile device detected - will ALWAYS use proxy`
3. Try searching for anime
4. Should work without CORS errors

### Verify Proxy is Working
1. Check server logs for: `[Proxy] Requesting: ... from origin: ...`
2. Check for successful responses: `[Proxy] Response status: 200`
3. No CORS errors in browser console

### Common Issues

#### Issue: Still getting CORS errors on mobile
**Solution**: 
- Check that the proxy endpoint is being called (look for `/api/proxy/animethemes/` in network tab)
- Verify CORS headers are present in response (check Response Headers)
- Check server logs for CORS warnings

#### Issue: Proxy returns 403
**Solution**:
- The animethemes.moe API may be blocking your server's IP
- Contact API maintainers to whitelist your Render IP
- Check server logs for the exact error from API

#### Issue: Requests work on desktop but not mobile
**Solution**:
- Verify mobile detection is working (check console logs)
- Ensure proxy is being used (not direct API)
- Check that CORS headers are being set properly

## Technical Details

### CORS Headers Set
```
Access-Control-Allow-Origin: <request-origin>
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Accept, Authorization, X-Requested-With
Access-Control-Allow-Credentials: true
Access-Control-Expose-Headers: Content-Length, Content-Type
```

### Mobile Detection
```javascript
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                      (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) ||
                      ('ontouchstart' in window);
```

### Proxy Endpoint
- Path: `/api/proxy/animethemes/*`
- Method: GET
- CORS: Enabled for all origins
- Server-side: Makes request to animethemes.moe API
- Returns: API response with CORS headers

## Benefits

1. **No CORS Errors on Mobile**: Mobile browsers always use proxy (same origin)
2. **Better Error Handling**: Errors include CORS headers so mobile can read them
3. **Automatic Detection**: Mobile devices automatically use proxy
4. **Backward Compatible**: Desktop still works as before
5. **No Data Scraping**: Uses official API through proxy (legitimate use)

## Important Notes

1. **Always Use Proxy on Mobile**: Never try direct API on mobile (will always fail with CORS)
2. **CORS Headers Required**: All responses must include CORS headers (including errors)
3. **OPTIONS Handler**: Required for some mobile browsers (preflight requests)
4. **Server-Side Requests**: Proxy makes server-to-server requests (no CORS restrictions)

## Deployment

After deploying these changes:
1. The proxy will work on mobile devices
2. No CORS errors should occur
3. All API requests go through your server (proxy)
4. Mobile browsers communicate only with your server (same origin)

## Monitoring

Check these in production:
1. Server logs for proxy requests
2. Browser console for mobile detection
3. Network tab for proxy endpoint usage
4. CORS headers in response headers

## Conclusion

The CORS issue on mobile is now fixed by:
- Always using the proxy on mobile devices
- Setting CORS headers on all responses
- Adding OPTIONS handler for preflight requests
- Improving error handling with CORS support

Mobile devices will now work perfectly without any CORS errors!

