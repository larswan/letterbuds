import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Proxy endpoint for letterboxd-list-radarr API
app.get('/api/watchlist/:username', async (req, res) => {
  const { username } = req.params;
  const apiUrl = `https://letterboxd-list-radarr.onrender.com/${username}/watchlist/`;
  
  console.log(`[${new Date().toISOString()}] [PROXY] Proxying request for ${username} to ${apiUrl}`);
  
  // Retry logic for rate limiting
  const maxRetries = 2;
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`[${new Date().toISOString()}] [PROXY] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    try {
      // Use minimal headers - the API might be detecting overly complex headers as bots
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'curl/7.68.0', // Simple user agent that works
        },
      });
      
      console.log(`[${new Date().toISOString()}] [PROXY] Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Could not read error response';
        }
        console.error(`[${new Date().toISOString()}] [PROXY] Error response body:`, errorText);
        
        // Retry on 403 or 429 (rate limiting)
        if ((response.status === 403 || response.status === 429) && attempt < maxRetries) {
          lastError = { status: response.status, text: errorText };
          continue; // Retry
        }
        
        // Handle 403 specifically
        if (response.status === 403) {
          return res.status(403).json({ 
            error: 'Access forbidden by letterboxd-list-radarr API. This may be due to rate limiting or anti-scraping measures.',
            details: errorText,
            suggestion: 'Please try again later. The service may be temporarily blocking requests.'
          });
        }
        
        // Handle 429 (Too Many Requests)
        if (response.status === 429) {
          return res.status(429).json({ 
            error: 'Rate limit exceeded. Too many requests to the letterboxd-list-radarr API.',
            details: errorText,
            suggestion: 'Please wait a few moments and try again.'
          });
        }
        
        return res.status(response.status).json({ 
          error: `Failed to fetch watchlist: ${response.status} ${response.statusText}`,
          details: errorText
        });
      }
      
      const data = await response.json();
      console.log(`[${new Date().toISOString()}] [PROXY] Successfully proxied data for ${username}, received ${Array.isArray(data) ? data.length : 'object'} items`);
      return res.json(data);
      
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${new Date().toISOString()}] [PROXY] Error on attempt ${attempt + 1}:`, errorMessage);
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        const errorStack = error instanceof Error ? error.stack : undefined;
        if (errorStack) {
          console.error(`[${new Date().toISOString()}] [PROXY] Error stack:`, errorStack);
        }
        return res.status(500).json({ 
          error: 'Failed to proxy request after retries',
          message: errorMessage
        });
      }
    }
  }
});

// Serve static files from dist directory in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')));
  
  // Handle React Router (SPA) - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Frontend should be running on http://localhost:5173`);
    console.log(`API proxy available at http://localhost:${PORT}/api/watchlist/:username`);
  }
});

