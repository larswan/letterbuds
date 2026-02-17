import { Film } from '../types';

const OMDb_API_KEY = import.meta.env.VITE_OMDB_API_KEY || '';
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

interface OMDbResponse {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: Array<{ Source: string; Value: string }>;
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  DVD: string;
  BoxOffice: string;
  Production: string;
  Website: string;
  Response: string;
  Error?: string;
}

interface TMDBMovieResponse {
  id: number;
  videos?: {
    results: Array<{
      key: string;
      site: string;
      type: string;
    }>;
  };
}

/**
 * Enrich film data using OMDb API
 */
export async function enrichFilmWithOMDb(film: Film): Promise<Film> {
  if (!film.imdbId || !OMDb_API_KEY) {
    return film;
  }

  try {
    const response = await fetch(
      `http://www.omdbapi.com/?i=${film.imdbId}&apikey=${OMDb_API_KEY}&plot=full`
    );
    
    if (!response.ok) {
      console.warn(`[ENRICH] OMDb API error for ${film.imdbId}: ${response.status}`);
      return film;
    }

    const data: OMDbResponse = await response.json();
    
    if (data.Response === 'False' || data.Error) {
      console.warn(`[ENRICH] OMDb API error for ${film.imdbId}: ${data.Error}`);
      return film;
    }

    return {
      ...film,
      posterUrl: data.Poster && data.Poster !== 'N/A' ? data.Poster : film.posterUrl,
      plot: data.Plot && data.Plot !== 'N/A' ? data.Plot : undefined,
      director: data.Director && data.Director !== 'N/A' ? data.Director : undefined,
      cast: data.Actors && data.Actors !== 'N/A' ? data.Actors.split(', ') : undefined,
      genre: data.Genre && data.Genre !== 'N/A' ? data.Genre.split(', ') : undefined,
      rating: data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : undefined,
      runtime: data.Runtime && data.Runtime !== 'N/A' ? data.Runtime : undefined,
    };
  } catch (error) {
    console.error(`[ENRICH] Error enriching film ${film.title} with OMDb:`, error);
    return film;
  }
}

/**
 * Get trailer URL from TMDB API
 */
export async function getTrailerFromTMDB(film: Film): Promise<string | undefined> {
  if (!TMDB_API_KEY) {
    return undefined;
  }

  // Try using TMDB ID first if available
  if (film.tmdbId) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/${film.tmdbId}/videos?api_key=${TMDB_API_KEY}`
      );
      
      if (response.ok) {
        const data: TMDBMovieResponse = await response.json();
        const trailer = data.videos?.results.find(
          v => v.site === 'YouTube' && v.type === 'Trailer'
        );
        if (trailer) {
          return `https://www.youtube.com/watch?v=${trailer.key}`;
        }
      }
    } catch (error) {
      console.warn(`[ENRICH] Error fetching trailer from TMDB for ${film.title}:`, error);
    }
  }

  // Fallback: search by title and year
  if (film.title && film.year) {
    try {
      const searchResponse = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(film.title)}&year=${film.year}`
      );
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.results && searchData.results.length > 0) {
          const tmdbId = searchData.results[0].id;
          const videoResponse = await fetch(
            `https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${TMDB_API_KEY}`
          );
          
          if (videoResponse.ok) {
            const videoData: TMDBMovieResponse = await videoResponse.json();
            const trailer = videoData.videos?.results.find(
              v => v.site === 'YouTube' && v.type === 'Trailer'
            );
            if (trailer) {
              return `https://www.youtube.com/watch?v=${trailer.key}`;
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[ENRICH] Error searching TMDB for ${film.title}:`, error);
    }
  }

  return undefined;
}

/**
 * Enrich a single film with all available data
 */
export async function enrichFilm(film: Film): Promise<Film> {
  let enriched = await enrichFilmWithOMDb(film);
  const trailerUrl = await getTrailerFromTMDB(enriched);
  
  return {
    ...enriched,
    trailerUrl,
  };
}

/**
 * Enrich multiple films (with conservative rate limiting to avoid API blocks)
 */
export async function enrichFilms(films: Film[]): Promise<Film[]> {
  // Limit to 50 films max per batch to avoid overwhelming APIs
  const MAX_ENRICHMENT_BATCH = 50;
  const filmsToEnrich = films.slice(0, MAX_ENRICHMENT_BATCH);
  
  if (films.length > MAX_ENRICHMENT_BATCH) {
    console.warn(`[ENRICH] Limiting enrichment to ${MAX_ENRICHMENT_BATCH} films (out of ${films.length}) to avoid API rate limits`);
  }
  
  const enriched: Film[] = [];
  
  for (let i = 0; i < filmsToEnrich.length; i++) {
    const film = filmsToEnrich[i];
    
    // Conservative rate limiting to avoid triggering API blocks:
    // - 500ms delay between each request (more conservative than before)
    // - 2 second delay every 5 films (extra breathing room)
    if (i > 0) {
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay every 5 films
      } else {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms between requests
      }
    }
    
    const enrichedFilm = await enrichFilm(film);
    enriched.push(enrichedFilm);
  }
  
  // Add any remaining films without enrichment
  if (films.length > MAX_ENRICHMENT_BATCH) {
    enriched.push(...films.slice(MAX_ENRICHMENT_BATCH));
  }
  
  return enriched;
}

