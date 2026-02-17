import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import { load } from 'cheerio';
import dotenv from 'dotenv';
import { writeFile, mkdir, readFile, access } from 'fs/promises';
import { constants } from 'fs';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Proxy endpoint for fetching following list
app.get('/api/following/:username', async (req, res) => {
  const { username } = req.params;
  const followingUrl = `https://letterboxd.com/${username}/following/`;
  
  console.log(`[${new Date().toISOString()}] [PROXY] Fetching following list for ${username} from ${followingUrl}`);
  
  // Retry logic for rate limiting/blocking
  // Increased retries and longer delays to avoid Cloudflare detection
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Longer delays with exponential backoff to avoid pattern detection
      const baseDelay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
      const jitter = Math.floor(Math.random() * 1000); // Add randomness
      const delay = baseDelay + jitter;
      console.log(`[${new Date().toISOString()}] [PROXY] Retrying following fetch in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  
    try {
      // Add a small random delay before each request to avoid rate limiting patterns
      if (attempt > 0) {
        const randomDelay = Math.floor(Math.random() * 1000) + 500; // 500-1500ms
        console.log(`[${new Date().toISOString()}] [PROXY] Adding random delay: ${randomDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
      }
      
      // Use more realistic browser headers to avoid detection
      // Rotate through different User-Agents to avoid pattern detection
      const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ];
      
      // Use different user agent each attempt, with some randomization
      const userAgentIndex = (attempt + Math.floor(Math.random() * userAgents.length)) % userAgents.length;
      const userAgent = userAgents[userAgentIndex];
      
      // Use comprehensive browser headers (same as profile endpoint but with Referer)
      // Remove some headers that might flag us as automated
      const headers = {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': `https://letterboxd.com/${username}/`,
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      };
      
      // Only add Sec-Fetch headers if not on first attempt (they might flag us)
      if (attempt > 0) {
        headers['Sec-Fetch-Dest'] = 'document';
        headers['Sec-Fetch-Mode'] = 'navigate';
        headers['Sec-Fetch-Site'] = 'same-origin';
        headers['Sec-Fetch-User'] = '?1';
      }
      
      console.log(`[${new Date().toISOString()}] [PROXY] Attempt ${attempt + 1}: Fetching with User-Agent: ${userAgent.substring(0, 50)}...`);
      
      const response = await fetch(followingUrl, {
        headers,
        redirect: 'follow',
      });
      
      console.log(`[${new Date().toISOString()}] [PROXY] Response status: ${response.status} ${response.statusText}`);
      console.log(`[${new Date().toISOString()}] [PROXY] Response headers:`, {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length'),
        'x-frame-options': response.headers.get('x-frame-options'),
      });
      
      if (!response.ok) {
        // Try to read response body for debugging (even on error)
        let errorBody = '';
        try {
          errorBody = await response.text();
          console.log(`[${new Date().toISOString()}] [PROXY] Error response body (first 500 chars):`, errorBody.substring(0, 500));
        } catch (e) {
          console.log(`[${new Date().toISOString()}] [PROXY] Could not read error response body`);
        }
        
        // Retry on 403, 429, or 503
        if ((response.status === 403 || response.status === 429 || response.status === 503) && attempt < maxRetries) {
          lastError = { status: response.status, text: response.statusText, body: errorBody.substring(0, 200) };
          console.log(`[${new Date().toISOString()}] [PROXY] Will retry after delay. Error: ${response.status} ${response.statusText}`);
          continue; // Retry
        }
        
        console.error(`[${new Date().toISOString()}] [PROXY] Error fetching following: ${response.status} ${response.statusText}`);
        console.error(`[${new Date().toISOString()}] [PROXY] Error details:`, {
          status: response.status,
          statusText: response.statusText,
          url: followingUrl,
          attempt: attempt + 1,
          errorBodyPreview: errorBody.substring(0, 200),
        });
        
        if (response.status === 403) {
          // Check if it's a Cloudflare challenge or similar
          const isCloudflare = errorBody.includes('challenge') || errorBody.includes('cf-') || errorBody.includes('cloudflare');
          const errorMsg = isCloudflare 
            ? 'Access blocked by Cloudflare protection. Letterboxd is using anti-bot measures.'
            : 'Access forbidden. Letterboxd may be blocking automated requests to this page.';
          
          return res.status(403).json({ 
            error: errorMsg,
            suggestion: 'This feature may not work reliably due to Letterboxd\'s anti-scraping measures. You can still manually add usernames to compare watchlists.',
            details: isCloudflare ? 'Cloudflare protection detected' : '403 Forbidden response'
          });
        }
        
        return res.status(response.status).json({ 
          error: `Failed to fetch following list: ${response.status} ${response.statusText}`,
          details: errorBody.substring(0, 200)
        });
      }
    
      const html = await response.text();
      console.log(`[${new Date().toISOString()}] [PROXY] Received HTML response, length: ${html.length} characters`);
      
      // Check for Cloudflare challenge pages first
      const isCloudflareChallenge = html.includes('challenge-platform') || 
                                     html.includes('cf-browser-verification') ||
                                     html.includes('Just a moment') ||
                                     html.includes('Checking your browser') ||
                                     html.includes('DDoS protection by Cloudflare') ||
                                     html.includes('cf-challenge') ||
                                     (html.includes('cloudflare') && html.length < 50000); // Cloudflare pages are usually small
      
      if (isCloudflareChallenge) {
        console.warn(`[${new Date().toISOString()}] [PROXY] Cloudflare challenge detected in response`);
        return res.status(403).json({ 
          error: 'Access blocked by Cloudflare protection. Letterboxd is using anti-bot measures.',
          suggestion: 'This feature may not work reliably due to Letterboxd\'s anti-scraping measures. You can still manually add usernames to compare watchlists.',
          details: 'Cloudflare challenge page detected'
        });
      }
      
      // Check if this is actually a following page (not an error page)
      const hasFollowingContent = html.includes('person-summary') || html.includes('col-member') || html.includes('table-person');
      console.log(`[${new Date().toISOString()}] [PROXY] HTML contains following page markers: ${hasFollowingContent}`);
      
      if (!hasFollowingContent) {
        console.warn(`[${new Date().toISOString()}] [PROXY] Warning: HTML doesn't appear to be a following page. First 500 chars:`, html.substring(0, 500));
        
        // Check if it's an error page or login required
        if (html.includes('Sign in') || html.includes('log in') || html.includes('login')) {
          return res.status(403).json({ 
            error: 'Following page requires authentication',
            suggestion: 'This user\'s following list may be private or require login.',
            username
          });
        }
        
        return res.status(404).json({ 
          error: 'Following page not found or has unexpected structure',
          username
        });
      }
      
      // Use cheerio to parse HTML (more reliable than regex)
      const $ = load(html);
      const followingUsers = [];
      
      console.log(`[${new Date().toISOString()}] [PROXY] Parsing HTML with cheerio...`);
      
      // Try multiple selectors to find person rows
      let personRows = $('td.col-member.table-person');
      console.log(`[${new Date().toISOString()}] [PROXY] Selector 'td.col-member.table-person': Found ${personRows.length} rows`);
      
      if (personRows.length === 0) {
        personRows = $('td.col-member');
        console.log(`[${new Date().toISOString()}] [PROXY] Selector 'td.col-member': Found ${personRows.length} rows`);
      }
      
      if (personRows.length === 0) {
        personRows = $('.person-summary').parent();
        console.log(`[${new Date().toISOString()}] [PROXY] Selector '.person-summary parent': Found ${personRows.length} rows`);
      }
      
      if (personRows.length === 0) {
        const allTds = $('td');
        console.log(`[${new Date().toISOString()}] [PROXY] Total <td> elements: ${allTds.length}`);
        const personSummaryDivs = $('.person-summary');
        console.log(`[${new Date().toISOString()}] [PROXY] Total .person-summary divs: ${personSummaryDivs.length}`);
      }
      
      console.log(`[${new Date().toISOString()}] [PROXY] Using ${personRows.length} person rows for parsing`);
      
      personRows.each((index, element) => {
        try {
          const $row = $(element);
          let $personSummary = $row.find('.person-summary');
          
          // If not found in row, try finding in parent tr
          if ($personSummary.length === 0) {
            $personSummary = $row.closest('tr').find('.person-summary');
            console.log(`[${new Date().toISOString()}] [PROXY] Row ${index}: Found person-summary in parent tr`);
          }
          
          if ($personSummary.length === 0) {
            console.warn(`[${new Date().toISOString()}] [PROXY] Row ${index}: No person-summary found. Row HTML sample:`, $row.html()?.substring(0, 200) || 'empty');
            return;
          }
          
          // Extract username from avatar link or name link
          const $avatarLink = $personSummary.find('a.avatar');
          const $nameLink = $personSummary.find('a.name');
          
          const avatarHref = $avatarLink.attr('href') || '';
          const nameHref = $nameLink.attr('href') || '';
          
          console.log(`[${new Date().toISOString()}] [PROXY] Row ${index}: avatarHref: "${avatarHref}", nameHref: "${nameHref}"`);
          console.log(`[${new Date().toISOString()}] [PROXY] Row ${index}: avatarLink found: ${$avatarLink.length > 0}, nameLink found: ${$nameLink.length > 0}`);
          
          // Extract username from href (format: /username/)
          const usernameMatch = (nameHref || avatarHref).match(/\/([^\/]+)\//);
          const username = usernameMatch ? usernameMatch[1].trim() : null;
          
          if (!username) {
            console.warn(`[${new Date().toISOString()}] [PROXY] Row ${index}: Could not extract username. avatarHref: "${avatarHref}", nameHref: "${nameHref}"`);
            console.warn(`[${new Date().toISOString()}] [PROXY] Row ${index}: Person summary HTML sample:`, $personSummary.html()?.substring(0, 300) || 'empty');
            return;
          }
          
          // Extract avatar URL
          const $avatarImg = $avatarLink.find('img');
          const avatarUrl = $avatarImg.attr('src') || null;
          const avatarAlt = $avatarImg.attr('alt') || '';
          
          // Extract display name
          const displayName = $nameLink.text().trim() || avatarAlt.trim() || username;
          
          console.log(`[${new Date().toISOString()}] [PROXY] Row ${index}: ✓ Extracted user - username: "${username}", displayName: "${displayName}", avatarUrl: ${avatarUrl ? 'present' : 'missing'}`);
          
          followingUsers.push({
            username,
            avatarUrl: avatarUrl || null,
            displayName: displayName && displayName !== username ? displayName : undefined,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          console.error(`[${new Date().toISOString()}] [PROXY] Error parsing row ${index}:`, errorMsg);
          if (errorStack) {
            console.error(`[${new Date().toISOString()}] [PROXY] Error stack:`, errorStack);
          }
        }
      });
      
      console.log(`[${new Date().toISOString()}] [PROXY] ✓ Successfully parsed ${followingUsers.length} following users for ${username}`);
      
      if (followingUsers.length === 0) {
        console.warn(`[${new Date().toISOString()}] [PROXY] ⚠️ Warning: No users found. Checking HTML structure...`);
        console.warn(`[${new Date().toISOString()}] [PROXY] HTML length: ${html.length} characters`);
        console.warn(`[${new Date().toISOString()}] [PROXY] Contains 'person-summary': ${html.includes('person-summary')}`);
        console.warn(`[${new Date().toISOString()}] [PROXY] Contains 'col-member': ${html.includes('col-member')}`);
        console.warn(`[${new Date().toISOString()}] [PROXY] Contains 'table-person': ${html.includes('table-person')}`);
        console.warn(`[${new Date().toISOString()}] [PROXY] HTML sample (first 1000 chars):`, html.substring(0, 1000));
      } else {
        console.log(`[${new Date().toISOString()}] [PROXY] Sample usernames:`, followingUsers.slice(0, 3).map(u => u.username).join(', '));
      }
      
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

// Health check endpoint (production only) - tests scraping capability
if (process.env.NODE_ENV === 'production') {
  app.get('/health', async (req, res) => {
    const testUsername = 'larswan';
    const WATCHLIST_API_BASE = process.env.WATCHLIST_API_BASE || 'https://letterboxd-list-radarr.onrender.com';
    const testUrl = `${WATCHLIST_API_BASE}/${testUsername}/watchlist/`;
    
    console.log(`[${new Date().toISOString()}] [HEALTH] Running health check - testing ${testUrl}`);
    
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout after 10 seconds')), 10000);
    });
    
    try {
      const fetchPromise = fetch(testUrl, {
        headers: {
          'User-Agent': 'curl/7.68.0',
        },
      });
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (response.ok) {
        const data = await response.json();
        const filmCount = Array.isArray(data) ? data.length : (data.movies?.length || data.items?.length || 0);
        console.log(`[${new Date().toISOString()}] [HEALTH] ✓ Health check passed - ${filmCount} films found`);
        res.status(200).json({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          testUser: testUsername,
          filmCount,
          apiBase: WATCHLIST_API_BASE
        });
      } else {
        console.error(`[${new Date().toISOString()}] [HEALTH] ✗ Health check failed - ${response.status} ${response.statusText}`);
        res.status(503).json({ 
          status: 'unhealthy', 
          timestamp: new Date().toISOString(),
          testUser: testUsername,
          error: `${response.status} ${response.statusText}`,
          apiBase: WATCHLIST_API_BASE
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[${new Date().toISOString()}] [HEALTH] ✗ Health check error:`, errorMsg);
      res.status(503).json({ 
        status: 'unhealthy', 
        timestamp: new Date().toISOString(),
        testUser: testUsername,
        error: errorMsg,
        apiBase: WATCHLIST_API_BASE
      });
    }
  });
}

// Proxy endpoint for letterboxd-list-radarr API
app.get('/api/watchlist/:username', async (req, res) => {
  const { username } = req.params;
  
  // First, check if enriched data exists
  try {
    const enrichedDir = join(__dirname, 'watchlist-data', 'enriched');
    const enrichedFile = join(enrichedDir, `${username}-watchlist.json`);
    
    try {
      await access(enrichedFile, constants.F_OK);
      // File exists, load and return enriched data
      console.log(`[${new Date().toISOString()}] [ENRICHED] Loading enriched data from ${enrichedFile}`);
      const enrichedData = JSON.parse(await readFile(enrichedFile, 'utf-8'));
      
      // Ensure data array exists
      if (!enrichedData.data || !Array.isArray(enrichedData.data)) {
        throw new Error('Enriched data does not contain a valid data array');
      }
      
      // Convert enriched data format to API response format
      const films = enrichedData.data.map((item) => ({
        title: item.title,
        release_year: item.year,
        imdb_id: item.imdbId,
        clean_title: item.cleanTitle,
        tmdbId: item.tmdbId,
        tmdb_id: item.tmdbId,
        posterUrl: item.posterUrl || null,
        poster: item.posterUrl || null,
        images: item.posterUrl ? [{ url: item.posterUrl }] : undefined,
      }));
      
      console.log(`[${new Date().toISOString()}] [ENRICHED] Returning ${films.length} enriched films for ${username} (${films.filter(f => f.posterUrl).length} with posters)`);
      return res.json(films);
    } catch (fileError) {
      // Enriched file doesn't exist, continue to API
      console.log(`[${new Date().toISOString()}] [ENRICHED] No enriched data found for ${username}, falling back to API`);
    }
  } catch (error) {
    // Error checking for enriched data, continue to API
    console.log(`[${new Date().toISOString()}] [ENRICHED] Error checking enriched data, falling back to API:`, error);
  }
  
  // Use local service if available, otherwise fall back to hosted version
  const WATCHLIST_API_BASE = process.env.WATCHLIST_API_BASE || 'https://letterboxd-list-radarr.onrender.com';
  const apiUrl = `${WATCHLIST_API_BASE}/${username}/watchlist/`;
  
  console.log(`[${new Date().toISOString()}] [PROXY] Proxying request for ${username} to ${apiUrl}`);
  
  // Retry logic for rate limiting and service unavailability
  const maxRetries = 3; // Increased retries for 503 errors
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Wait before retry (exponential backoff with longer delays for 503)
      const baseDelay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
      const jitter = Math.floor(Math.random() * 1000); // Add randomness to avoid thundering herd
      const delay = baseDelay + jitter;
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
        // For 503, always retry (service might be temporarily down)
        if ((response.status === 403 || response.status === 429 || response.status === 503) && attempt < maxRetries) {
          lastError = { status: response.status, text: errorText };
          console.log(`[${new Date().toISOString()}] [PROXY] Got ${response.status}, will retry (attempt ${attempt + 1}/${maxRetries + 1})`);
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
      
      // Write watchlist data to file for inspection
      try {
        const outputDir = join(__dirname, 'watchlist-data');
        // Create directory if it doesn't exist
        try {
          await mkdir(outputDir, { recursive: true });
        } catch (e) {
          // Directory might already exist, that's fine
        }
        
        const outputFile = join(outputDir, `${username}-watchlist.json`);
        const outputData = {
          username,
          timestamp: new Date().toISOString(),
          apiUrl,
          data: data,
          itemCount: Array.isArray(data) ? data.length : (data.movies?.length || data.items?.length || 0),
        };
        
        await writeFile(outputFile, JSON.stringify(outputData, null, 2), 'utf-8');
        console.log(`[${new Date().toISOString()}] [PROXY] Wrote watchlist data to ${outputFile}`);
      } catch (fileError) {
        // Don't fail the request if file write fails
        console.error(`[${new Date().toISOString()}] [PROXY] Failed to write watchlist data to file:`, fileError);
      }
      
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

// Endpoint to save enriched film data
app.post('/api/enrich-and-save', async (req, res) => {
  const { username, films } = req.body;
  
  if (!username || !films) {
    return res.status(400).json({ error: 'Username and films are required' });
  }
  
  try {
    const outputDir = join(__dirname, 'enriched-data');
    await mkdir(outputDir, { recursive: true });
    
    const enrichedFile = join(outputDir, `${username}-enriched.json`);
    const enrichedData = {
      username,
      timestamp: new Date().toISOString(),
      filmCount: films.length,
      films
    };
    
    await writeFile(
      enrichedFile,
      JSON.stringify(enrichedData, null, 2),
      'utf-8'
    );
    
    console.log(`[${new Date().toISOString()}] [ENRICH] Wrote enriched data to ${enrichedFile}`);
    res.json({ success: true, file: enrichedFile, filmCount: films.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${new Date().toISOString()}] [ENRICH] Error:`, errorMessage);
    res.status(500).json({ error: 'Failed to save enriched data', message: errorMessage });
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

