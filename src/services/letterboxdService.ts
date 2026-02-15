import { Film, UserProfile, FollowingUser } from '../types';

// Use proxy endpoint (works in both dev and production)
// In dev: Vite proxies /api to Express server
// In production: Express server handles /api directly
const API_BASE_URL = '/api';

/**
 * Parse following users from Letterboxd HTML
 */
function parseFollowingHTML(html: string): FollowingUser[] {
  const followingUsers: FollowingUser[] = [];
  
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
  
  return followingUsers;
}

export async function fetchWatchlist(username: string): Promise<Film[]> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [FETCH] Fetching watchlist for ${username}...`);

  try {
    const url = `${API_BASE_URL}/watchlist/${username}`;
    const response = await fetch(url);

    if (!response.ok) {
      let errorData: any = null;
      try {
        errorData = await response.json();
      } catch (e) {
        // If response is not JSON, use status text
      }
      
      if (response.status === 404) {
        console.error(`[${timestamp}] [ERROR] User ${username} not found or watchlist is empty`);
        throw new Error(`User "${username}" not found or watchlist is empty`);
      }
      
      if (response.status === 403) {
        const errorMsg = errorData?.error || errorData?.suggestion || 'Access forbidden. The API may be rate-limiting requests. Please try again later.';
        console.error(`[${timestamp}] [ERROR] Access forbidden for ${username}:`, errorMsg);
        throw new Error(errorMsg);
      }
      
      if (response.status === 429) {
        const errorMsg = errorData?.error || errorData?.suggestion || 'Rate limit exceeded. Please wait a few moments and try again.';
        console.error(`[${timestamp}] [ERROR] Rate limit exceeded for ${username}:`, errorMsg);
        throw new Error(errorMsg);
      }
      
      if (response.status === 503) {
        const errorMsg = errorData?.error || errorData?.suggestion || 'Service temporarily unavailable. The API may be overloaded. Please try again in a moment.';
        console.error(`[${timestamp}] [ERROR] Service unavailable for ${username}:`, errorMsg);
        throw new Error(errorMsg);
      }
      
      const errorMsg = errorData?.error || `Failed to fetch watchlist: ${response.status} ${response.statusText}`;
      throw new Error(errorMsg);
    }

    const data = await response.json();
    
    // Parse the API response format
    // The API returns an array of movie objects with: id, imdb_id, title, release_year, clean_title, adult
    let moviesArray: any[] = [];
    
    if (Array.isArray(data)) {
      moviesArray = data;
    } else if (data && Array.isArray(data.movies)) {
      moviesArray = data.movies;
    } else if (data && Array.isArray(data.items)) {
      moviesArray = data.items;
    }
    
    const films: Film[] = moviesArray
      .map((movie: any) => {
        // Handle the actual API response format
        const title = movie.title || movie.name || movie.movieTitle || '';
        // API uses release_year as a string, convert to number
        const year = movie.release_year || movie.year || movie.releaseYear;
        // API doesn't provide tmdbId directly, but has id (Letterboxd ID) and imdb_id
        const tmdbId = movie.tmdbId || movie.tmdb_id || movie.theMovieDbId;
        // API doesn't provide poster URLs in this format
        const posterUrl = movie.images?.[0]?.url || 
                         movie.posterUrl || 
                         movie.poster || 
                         movie.remotePoster;
        
        return {
          title: title.trim(),
          year: year ? parseInt(String(year), 10) : undefined,
          tmdbId: tmdbId ? parseInt(String(tmdbId), 10) : undefined,
          posterUrl: posterUrl || undefined,
        };
      })
      .filter((film: Film) => film.title.length > 0); // Filter out empty titles

    const count = films.length;
    console.log(`[${new Date().toISOString()}] [SUCCESS] Retrieved ${count} films for ${username}`);
    
    return films;
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] Error fetching ${username}:`, error);
    throw error;
  }
}

export async function fetchUserProfile(username: string, throwOnError: boolean = false): Promise<UserProfile> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [FETCH] Fetching profile for ${username}...`);

  try {
    const url = `${API_BASE_URL}/profile/${username}`;
    const response = await fetch(url);

    if (!response.ok) {
      let errorData: any = null;
      try {
        errorData = await response.json();
      } catch (e) {
        // If response is not JSON, use status text
      }
      
      if (response.status === 404) {
        console.error(`[${timestamp}] [ERROR] User ${username} not found`);
        const error = new Error(`User "${username}" not found`);
        if (throwOnError) throw error;
        return { username, avatarUrl: null };
      }
      
      const errorMsg = errorData?.error || `Failed to fetch profile: ${response.status} ${response.statusText}`;
      const error = new Error(errorMsg);
      if (throwOnError) throw error;
      return { username, avatarUrl: null };
    }

    const data = await response.json();
    console.log(`[${new Date().toISOString()}] [SUCCESS] Retrieved profile for ${username}, avatar: ${data.avatarUrl || 'none'}`);
    
    return {
      username: data.username || username,
      avatarUrl: data.avatarUrl || null,
    };
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] Error fetching profile for ${username}:`, error);
    if (throwOnError) {
      throw error;
    }
    // Return a profile with null avatar on error (non-blocking)
    return {
      username,
      avatarUrl: null,
    };
  }
}

export async function fetchFollowing(username: string): Promise<FollowingUser[]> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [FETCH] Fetching following list for ${username}...`);

  // Try direct browser fetch first (uses user's browser context, cookies, etc.)
  // This may bypass Letterboxd's anti-scraping if the user is logged in
  const directUrl = `https://letterboxd.com/${username}/following/`;
  
  try {
    console.log(`[${timestamp}] [FETCH] Attempting direct browser fetch from ${directUrl}...`);
    const directResponse = await fetch(directUrl, {
      method: 'GET',
      credentials: 'include', // Include cookies if user is logged into Letterboxd
      mode: 'cors', // Try CORS first
    });
    
    if (directResponse.ok) {
      const html = await directResponse.text();
      const following = parseFollowingHTML(html);
      console.log(`[${new Date().toISOString()}] [SUCCESS] Retrieved ${following.length} following users via direct browser fetch`);
      return following;
    }
  } catch (corsError) {
    // CORS blocked - fall back to server proxy
    console.log(`[${timestamp}] [FETCH] Direct fetch blocked by CORS, falling back to server proxy...`);
  }

  // Fall back to server proxy
  let serverError: Error | null = null;
  try {
    const url = `${API_BASE_URL}/following/${username}`;
    const response = await fetch(url);

    if (!response.ok) {
      let errorData: any = null;
      try {
        errorData = await response.json();
      } catch (e) {
        // If response is not JSON, use status text
      }
      
      if (response.status === 404) {
        console.error(`[${timestamp}] [ERROR] User ${username} not found or following list is empty`);
        throw new Error(`User "${username}" not found or following list is empty`);
      }
      
      if (response.status === 403) {
        const errorMsg = errorData?.error || 'Access forbidden. Letterboxd may be blocking automated requests.';
        const suggestion = errorData?.suggestion || 'You can still manually add usernames to compare watchlists.';
        console.error(`[${timestamp}] [ERROR] Access forbidden for ${username}:`, errorMsg);
        const fullError = new Error(errorMsg);
        (fullError as any).suggestion = suggestion;
        throw fullError;
      }
      
      const errorMsg = errorData?.error || `Failed to fetch following list: ${response.status} ${response.statusText}`;
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const following = data.following || [];
    
    console.log(`[${new Date().toISOString()}] [SUCCESS] Retrieved ${following.length} following users for ${username}`);
    
    return following;
  } catch (error) {
    serverError = error instanceof Error ? error : new Error(String(error));
    console.log(`[${timestamp}] [FETCH] Server proxy failed, trying CORS proxy as last resort...`);
    
    // Last resort: Try a public CORS proxy
    // Note: These services may have rate limits or be unreliable
    try {
      const corsProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;
      console.log(`[${timestamp}] [FETCH] Attempting CORS proxy fetch...`);
      
      const proxyResponse = await fetch(corsProxyUrl, {
        method: 'GET',
        mode: 'cors',
      });
      
      if (proxyResponse.ok) {
        const html = await proxyResponse.text();
        const following = parseFollowingHTML(html);
        console.log(`[${new Date().toISOString()}] [SUCCESS] Retrieved ${following.length} following users via CORS proxy`);
        return following;
      } else {
        throw new Error(`CORS proxy returned ${proxyResponse.status}`);
      }
    } catch (proxyError) {
      // All methods failed - throw the original server error
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [ERROR] All fetch methods failed for ${username}`);
      throw serverError;
    }
  }
}

