import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import { load } from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Proxy endpoint for fetching following list
app.get('/api/following/:username', async (req, res) => {
  const { username } = req.params;
  const followingUrl = `https://letterboxd.com/${username}/following/`;
  
  console.log(`[${new Date().toISOString()}] [PROXY] Fetching following list for ${username} from ${followingUrl}`);
  
  // Retry logic for rate limiting/blocking
  const maxRetries = 2;
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`[${new Date().toISOString()}] [PROXY] Retrying following fetch in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  
    try {
      // Try different User-Agent strategies
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'curl/7.68.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ];
      
      // Use same headers as profile endpoint (which works)
      const response = await fetch(followingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });
      
      console.log(`[${new Date().toISOString()}] [PROXY] Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        // Retry on 403, 429, or 503
        if ((response.status === 403 || response.status === 429 || response.status === 503) && attempt < maxRetries) {
          lastError = { status: response.status, text: response.statusText };
          continue; // Retry
        }
        
        console.error(`[${new Date().toISOString()}] [PROXY] Error fetching following: ${response.status} ${response.statusText}`);
        
        if (response.status === 403) {
          return res.status(403).json({ 
            error: 'Access forbidden. Letterboxd may be blocking automated requests to this page.',
            suggestion: 'This feature may not work for all users due to Letterboxd\'s anti-scraping measures.'
          });
        }
        
        return res.status(response.status).json({ 
          error: `Failed to fetch following list: ${response.status} ${response.statusText}` 
        });
      }
    
      const html = await response.text();
      
      // Parse HTML to extract following users
      // Pattern: <tr> with table-person, contains avatar link and name link
      const followingUsers = [];
      
      // Match table rows containing person-summary divs
      const rowMatches = html.match(/<tr[^>]*>[\s\S]*?<td[^>]*class="[^"]*col-member[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*person-summary[^"]*"[\s\S]*?<\/tr>/g);
      
      if (rowMatches) {
        for (const row of rowMatches) {
          // Extract avatar URL and username from avatar link
          const avatarMatch = row.match(/<a[^>]*class="[^"]*avatar[^"]*"[^>]*href="\/([^\/"]+)\/"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/);
          
          // Extract username and display name from name link
          const nameMatch = row.match(/<a[^>]*href="\/([^\/"]+)\/"[^>]*class="[^"]*name[^"]*"[^>]*>[\s\S]*?([^<]+)<\/a>/);
          
          if (avatarMatch || nameMatch) {
            const username = (nameMatch?.[1] || avatarMatch?.[1] || '').trim();
            const avatarUrl = avatarMatch?.[2]?.trim() || null;
            const displayName = (nameMatch?.[2]?.trim() || avatarMatch?.[3]?.trim() || username).trim();
            
            if (username) {
              followingUsers.push({
                username,
                avatarUrl: avatarUrl || null,
                displayName: displayName && displayName !== username ? displayName : undefined,
              });
            }
          }
        }
      }
      
      console.log(`[${new Date().toISOString()}] [PROXY] Successfully parsed ${followingUsers.length} following users for ${username}`);
      return res.json({ following: followingUsers });
      
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
          error: 'Failed to fetch following list after retries',
          message: errorMessage
        });
      }
    }
  }
});

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
        
        // Retry on 403, 429, or 503 (rate limiting or service unavailable)
        if ((response.status === 403 || response.status === 429 || response.status === 503) && attempt < maxRetries) {
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
        
        // Handle 503 (Service Unavailable)
        if (response.status === 503) {
          return res.status(503).json({ 
            error: 'Service temporarily unavailable. The letterboxd-list-radarr API may be overloaded or down.',
            details: errorText,
            suggestion: 'Please wait a few moments and try again. The service may be experiencing high traffic.'
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

// Scrape user profile endpoint
app.get('/api/profile/:username', async (req, res) => {
  const { username } = req.params;
  const profileUrl = `https://letterboxd.com/${username}/`;
  
  console.log(`[${new Date().toISOString()}] [SCRAPE] Scraping profile for ${username} from ${profileUrl}`);
  
  try {
    const response = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    
    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] [SCRAPE] Failed to fetch profile: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `Failed to fetch profile: ${response.status} ${response.statusText}`,
        username
      });
    }
    
    const html = await response.text();
    const $ = load(html);
    
    // Check if this is actually a profile page (not an error page)
    // Look for profile-specific elements
    const hasProfileHeader = $('.profile-header, .profile-summary').length > 0;
    const hasProfileName = $('.person-display-name, .profile-name-and-actions').length > 0;
    
    // If no profile elements found, user doesn't exist
    if (!hasProfileHeader && !hasProfileName) {
      console.log(`[${new Date().toISOString()}] [SCRAPE] No profile found for ${username}`);
      return res.status(404).json({ 
        error: 'User not found',
        username
      });
    }
    
    // Find the avatar image - it's in a div with class "profile-avatar" containing an img
    let avatarUrl = null;
    
    // Try multiple selectors to find the avatar
    let avatarImg = $('.profile-avatar img').first();
    if (avatarImg.length === 0) {
      avatarImg = $('.profile-avatar .avatar img').first();
    }
    if (avatarImg.length === 0) {
      avatarImg = $(`img[alt="${username}"]`).first();
    }
    if (avatarImg.length === 0) {
      // Try looking for any avatar in the profile header
      const profileHeader = $('.profile-header, .profile-summary');
      avatarImg = profileHeader.find('img').first();
    }
    
    if (avatarImg.length > 0) {
      avatarUrl = avatarImg.attr('src') || null;
    }
    
    console.log(`[${new Date().toISOString()}] [SCRAPE] Successfully scraped profile for ${username}, avatar: ${avatarUrl || 'not found'}`);
    
    return res.json({
      username,
      avatarUrl,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${new Date().toISOString()}] [SCRAPE] Error scraping profile for ${username}:`, errorMessage);
    return res.status(500).json({ 
      error: 'Failed to scrape profile',
      message: errorMessage,
      username
    });
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

