import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OMDb_API_KEY = process.env.VITE_OMDB_API_KEY || '';
const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY || '';

// Transform watchlist entry to Film format
function toFilm(entry) {
  return {
    title: entry.title,
    year: entry.release_year ? parseInt(entry.release_year, 10) : undefined,
    imdbId: entry.imdb_id,
    cleanTitle: entry.clean_title,
    tmdbId: entry.tmdb_id || entry.tmdbId || entry.theMovieDbId,
  };
}

// Enrich film with OMDb data - returns full API response
async function enrichFilmWithOMDb(film) {
  if (!film.imdbId || !OMDb_API_KEY) {
    return { ...film, omdbResponse: null, omdbError: 'Missing IMDb ID or API key' };
  }

  try {
    const response = await fetch(
      `http://www.omdbapi.com/?i=${film.imdbId}&apikey=${OMDb_API_KEY}&plot=full`
    );
    
    if (!response.ok) {
      const error = `HTTP ${response.status}`;
      console.warn(`[ENRICH] OMDb API error for ${film.imdbId}: ${error}`);
      return { ...film, omdbResponse: null, omdbError: error };
    }

    const data = await response.json();
    
    if (data.Response === 'False' || data.Error) {
      console.warn(`[ENRICH] OMDb API error for ${film.imdbId}: ${data.Error}`);
      return { ...film, omdbResponse: data, omdbError: data.Error };
    }

    // Return full OMDb response
    return {
      ...film,
      omdbResponse: data,
      omdbError: null,
    };
  } catch (error) {
    console.error(`[ENRICH] Error enriching film ${film.title} with OMDb:`, error);
    return { ...film, omdbResponse: null, omdbError: error.message };
  }
}

// Get full TMDB data - returns full API responses
async function getFullTMDBData(film) {
  if (!TMDB_API_KEY) {
    return { tmdbSearchResponse: null, tmdbMovieResponse: null, tmdbVideosResponse: null, tmdbError: 'Missing API key' };
  }

  const result = {
    tmdbSearchResponse: null,
    tmdbMovieResponse: null,
    tmdbVideosResponse: null,
    tmdbError: null,
    tmdbId: film.tmdbId || null,
  };

  // Try using TMDB ID first if available
  if (film.tmdbId) {
    try {
      // Get movie details
      const movieResponse = await fetch(
        `https://api.themoviedb.org/3/movie/${film.tmdbId}?api_key=${TMDB_API_KEY}`
      );
      
      if (movieResponse.ok) {
        result.tmdbMovieResponse = await movieResponse.json();
      }

      // Get videos
      const videosResponse = await fetch(
        `https://api.themoviedb.org/3/movie/${film.tmdbId}/videos?api_key=${TMDB_API_KEY}`
      );
      
      if (videosResponse.ok) {
        result.tmdbVideosResponse = await videosResponse.json();
      }
    } catch (error) {
      console.warn(`[ENRICH] Error fetching from TMDB for ${film.title}:`, error);
      result.tmdbError = error.message;
    }
  }

  // Fallback: search by title and year
  if ((!result.tmdbMovieResponse || !result.tmdbVideosResponse) && film.title && film.year) {
    try {
      const searchResponse = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(film.title)}&year=${film.year}`
      );
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        result.tmdbSearchResponse = searchData;
        
        if (searchData.results && searchData.results.length > 0) {
          const tmdbId = searchData.results[0].id;
          result.tmdbId = tmdbId;
          
          // Get movie details
          if (!result.tmdbMovieResponse) {
            const movieResponse = await fetch(
              `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
            );
            
            if (movieResponse.ok) {
              result.tmdbMovieResponse = await movieResponse.json();
            }
          }
          
          // Get videos
          if (!result.tmdbVideosResponse) {
            const videoResponse = await fetch(
              `https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${TMDB_API_KEY}`
            );
            
            if (videoResponse.ok) {
              result.tmdbVideosResponse = await videoResponse.json();
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[ENRICH] Error searching TMDB for ${film.title}:`, error);
      if (!result.tmdbError) {
        result.tmdbError = error.message;
      }
    }
  }

  return result;
}

// Build poster URLs for all sizes from TMDB poster_path
function buildPosterUrls(posterPath) {
  if (!posterPath) {
    return null;
  }

  const baseUrl = 'https://image.tmdb.org/t/p';
  const sizes = ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'];
  
  const urls = {};
  sizes.forEach(size => {
    urls[size] = `${baseUrl}/${size}${posterPath}`;
  });
  
  return urls;
}

// Build backdrop URLs for all sizes from TMDB backdrop_path
function buildBackdropUrls(backdropPath) {
  if (!backdropPath) {
    return null;
  }

  const baseUrl = 'https://image.tmdb.org/t/p';
  const sizes = ['w300', 'w780', 'w1280', 'original'];
  
  const urls = {};
  sizes.forEach(size => {
    urls[size] = `${baseUrl}/${size}${backdropPath}`;
  });
  
  return urls;
}

// Enrich a single film with full API responses
async function enrichFilm(film) {
  const omdbData = await enrichFilmWithOMDb(film);
  const tmdbData = await getFullTMDBData(omdbData);
  
  // Build poster and backdrop URLs if we have TMDB movie data
  let posterUrls = null;
  let backdropUrls = null;
  
  if (tmdbData.tmdbMovieResponse) {
    posterUrls = buildPosterUrls(tmdbData.tmdbMovieResponse.poster_path);
    backdropUrls = buildBackdropUrls(tmdbData.tmdbMovieResponse.backdrop_path);
  }
  
  return {
    ...omdbData,
    ...tmdbData,
    posterUrls,
    backdropUrls,
    // Also add a default posterUrl for convenience (using w500)
    posterUrl: posterUrls ? posterUrls.w500 : null,
  };
}

// Enrich multiple films with rate limiting (only first 3)
async function enrichFilms(films) {
  const enriched = [];
  const filmsToProcess = films.slice(0, 3); // Only first 3 movies
  
  console.log(`Processing only first ${filmsToProcess.length} films out of ${films.length} total`);
  
  for (let i = 0; i < filmsToProcess.length; i++) {
    const film = filmsToProcess[i];
    
    // Rate limiting: 500ms between requests, 2 second delay every 5 films
    if (i > 0) {
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`[${i + 1}/${filmsToProcess.length}] Enriching: ${film.title} (${film.year || 'N/A'})`);
    const enrichedFilm = await enrichFilm(film);
    enriched.push(enrichedFilm);
  }
  
  // Add remaining films without enrichment
  if (films.length > 3) {
    enriched.push(...films.slice(3));
  }
  
  return enriched;
}

// Process a single watchlist file
async function processWatchlistFile(filePath) {
  console.log(`\nProcessing: ${filePath}`);
  
  const content = await readFile(filePath, 'utf-8');
  const watchlist = JSON.parse(content);
  
  // Transform to Film format
  const films = watchlist.data.map(toFilm);
  console.log(`Found ${films.length} films`);
  
  // Enrich films
  const enrichedFilms = await enrichFilms(films);
  
  // Create enriched watchlist object
  const enrichedWatchlist = {
    ...watchlist,
    data: enrichedFilms,
    enrichedAt: new Date().toISOString(),
  };
  
  // Save to enriched subfolder
  const enrichedDir = join(__dirname, 'watchlist-data', 'enriched');
  await mkdir(enrichedDir, { recursive: true });
  
  const filename = filePath.split('/').pop() || filePath.split('\\').pop();
  const outputPath = join(enrichedDir, filename);
  
  await writeFile(outputPath, JSON.stringify(enrichedWatchlist, null, 2));
  console.log(`Saved enriched data to: ${outputPath}`);
  
  return enrichedWatchlist;
}

// Main function
async function main() {
  const watchlistDir = join(__dirname, 'watchlist-data');
  const files = [
    join(watchlistDir, 'larswan-watchlist.json'),
    join(watchlistDir, 'nancopeland-watchlist.json'),
    join(watchlistDir, 'CRGCRGCRG-watchlist.json'),
    join(watchlistDir, 'itscharlibb-watchlist.json'),
  ];
  
  console.log('Starting watchlist enrichment...');
  console.log(`OMDb API Key: ${OMDb_API_KEY ? 'Found' : 'Missing'}`);
  console.log(`TMDB API Key: ${TMDB_API_KEY ? 'Found' : 'Missing'}`);
  
  for (const file of files) {
    try {
      await processWatchlistFile(file);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }
  
  console.log('\nEnrichment complete!');
}

main().catch(console.error);

