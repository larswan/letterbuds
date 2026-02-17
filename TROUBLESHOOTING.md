# Troubleshooting Guide

## How to Check Logs

### 1. Browser Console (Frontend Logs)
1. Open your browser's Developer Tools:
   - **Chrome/Edge**: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - **Firefox**: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - **Safari**: Enable Developer menu in Preferences, then `Cmd+Option+I`

2. Go to the **Console** tab

3. Look for errors prefixed with:
   - `[ERROR]` - Error messages
   - `[FETCH]` - Fetch operations
   - `[COMPARE]` - Comparison operations

4. Common error patterns:
   ```
   [ERROR] Failed to fetch data for [username]: [error message]
   [ERROR] Watchlist fetch failed for [username]: { status: 403, ... }
   ```

### 2. Server Terminal (Backend/Proxy Logs)
1. Find the terminal where you ran `npm run dev:server` or `npm start`

2. Look for logs prefixed with:
   - `[PROXY]` - Proxy server operations
   - `[ERROR]` - Server-side errors

3. Common log patterns:
   ```
   [PROXY] Proxying request for [username] to https://letterboxd-list-radarr.onrender.com/[username]/watchlist/
   [PROXY] Response status: 403 Forbidden
   [PROXY] Error response body: [error details]
   ```

### 3. Test API Directly

#### Test the Proxy Server
Open these URLs in your browser (replace `localhost:3000` with your server URL):
- `http://localhost:3000/api/watchlist/CRGCRGCRG`
- `http://localhost:3000/api/watchlist/larswan`

#### Test the External API Directly
Open these URLs in your browser:
- `https://letterboxd-list-radarr.onrender.com/CRGCRGCRG/watchlist/`
- `https://letterboxd-list-radarr.onrender.com/larswan/watchlist/`

**What to look for:**
- **200 OK**: API is working, check proxy/server logs
- **403 Forbidden**: API is blocking requests (rate limiting or anti-scraping)
- **404 Not Found**: User doesn't exist or watchlist is empty
- **429 Too Many Requests**: Rate limit exceeded
- **503 Service Unavailable**: API is down or overloaded

### 4. Common Issues and Solutions

#### Issue: 403 Forbidden
**Cause**: The external API is blocking requests (anti-scraping measures)

**Solutions**:
1. Wait a few minutes and try again (rate limiting)
2. Check if the API service is down: https://letterboxd-list-radarr.onrender.com
3. The server uses a simple `curl/7.68.0` User-Agent to avoid detection

#### Issue: 429 Too Many Requests
**Cause**: Too many requests in a short time

**Solutions**:
1. Wait 1-2 minutes before trying again
2. The app already has delays between requests (500ms)

#### Issue: 503 Service Unavailable
**Cause**: The external API service is down or overloaded

**Solutions**:
1. Check the API status
2. Wait a few minutes and try again
3. The service is on Render's free tier, which may have limitations

#### Issue: Network/CORS Errors
**Cause**: Network connectivity or CORS issues

**Solutions**:
1. Check your internet connection
2. Make sure the proxy server is running
3. Check server logs for connection errors

### 5. Enhanced Logging

The app now includes enhanced error logging that shows:
- Full error messages
- HTTP status codes
- Response bodies (first 500 characters)
- Stack traces for debugging

All errors are logged to both:
- Browser console (frontend errors)
- Server terminal (backend/proxy errors)

### 6. Quick Debug Steps

1. **Check if server is running**:
   ```bash
   # Should see server listening on port 3000
   npm run dev:server
   ```

2. **Test a single user in browser console**:
   ```javascript
   fetch('http://localhost:3000/api/watchlist/larswan')
     .then(r => r.json())
     .then(console.log)
     .catch(console.error)
   ```

3. **Check server response**:
   - Look at the Network tab in DevTools
   - Find the failed request
   - Check the Response tab for error details

### 7. Getting Help

When reporting issues, include:
- Browser console errors (screenshot or copy/paste)
- Server terminal logs (copy/paste)
- The exact error message from the UI
- Which users are failing
- Whether it worked before and when it stopped working

