import { Film } from '../types';

// Use proxy endpoint (works in both dev and production)
// In dev: Vite proxies /api to Express server
// In production: Express server handles /api directly
const API_BASE_URL = '/api';

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

