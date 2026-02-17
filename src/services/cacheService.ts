import { Film, UserProfile } from '../types';

interface CachedWatchlist {
  films: Film[];
  timestamp: number;
}

interface CachedProfile {
  profile: UserProfile;
  timestamp: number;
}

interface CachedEnrichedData {
  films: Film[];
  timestamp: number;
}

// Cache configuration
const MAX_WATCHLIST_CACHE_SIZE = 50; // Max number of watchlists to cache
const MAX_ENRICHED_CACHE_SIZE = 20; // Max number of enriched datasets to cache
const CACHE_TTL = 1000 * 60 * 60; // 1 hour TTL for cache entries

class SessionCache {
  private watchlistCache: Map<string, CachedWatchlist> = new Map();
  private profileCache: Map<string, CachedProfile> = new Map();
  private enrichedCache: Map<string, CachedEnrichedData> = new Map();

  /**
   * Get cached watchlist or null if not found/expired
   */
  getWatchlist(username: string): Film[] | null {
    const cached = this.watchlistCache.get(username);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.watchlistCache.delete(username);
      return null;
    }

    return cached.films;
  }

  /**
   * Store watchlist in cache
   */
  setWatchlist(username: string, films: Film[]): void {
    // Evict oldest entries if cache is full
    if (this.watchlistCache.size >= MAX_WATCHLIST_CACHE_SIZE) {
      const oldestKey = this.getOldestKey(this.watchlistCache);
      if (oldestKey) {
        this.watchlistCache.delete(oldestKey);
      }
    }

    this.watchlistCache.set(username, {
      films,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached profile or null if not found/expired
   */
  getProfile(username: string): UserProfile | null {
    const cached = this.profileCache.get(username);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.profileCache.delete(username);
      return null;
    }

    return cached.profile;
  }

  /**
   * Store profile in cache
   */
  setProfile(username: string, profile: UserProfile): void {
    this.profileCache.set(username, {
      profile,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached enriched data or null if not found/expired
   */
  getEnrichedData(username: string): Film[] | null {
    const cached = this.enrichedCache.get(username);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.enrichedCache.delete(username);
      return null;
    }

    return cached.films;
  }

  /**
   * Store enriched data in cache
   */
  setEnrichedData(username: string, films: Film[]): void {
    // Evict oldest entries if cache is full
    if (this.enrichedCache.size >= MAX_ENRICHED_CACHE_SIZE) {
      const oldestKey = this.getOldestKey(this.enrichedCache);
      if (oldestKey) {
        this.enrichedCache.delete(oldestKey);
      }
    }

    this.enrichedCache.set(username, {
      films,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached enriched film by film key (title-year or imdbId)
   */
  getEnrichedFilm(film: Film): Film | null {
    const filmKey = this.getFilmKey(film);
    const cached = this.enrichedCache.get(`film-${filmKey}`);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.enrichedCache.delete(`film-${filmKey}`);
      return null;
    }

    // Find the matching film in cached array
    return cached.films.find(f => this.getFilmKey(f) === filmKey) || null;
  }

  /**
   * Store a single enriched film in cache
   */
  setEnrichedFilm(film: Film): void {
    const filmKey = this.getFilmKey(film);
    const cacheKey = `film-${filmKey}`;
    
    // Evict oldest entries if cache is full
    if (this.enrichedCache.size >= MAX_ENRICHED_CACHE_SIZE) {
      const oldestKey = this.getOldestKey(this.enrichedCache);
      if (oldestKey && !oldestKey.startsWith('film-')) {
        // Only evict non-film entries if possible
        this.enrichedCache.delete(oldestKey);
      }
    }

    this.enrichedCache.set(cacheKey, {
      films: [film],
      timestamp: Date.now(),
    });
  }

  /**
   * Merge enriched data into existing films by matching title and year
   */
  mergeEnrichedDataIntoFilms(films: Film[], enrichedFilms: Film[]): Film[] {
    const enrichedMap = new Map<string, Film>();
    
    // Create a map of enriched films by title+year key
    enrichedFilms.forEach(film => {
      const key = this.getFilmKey(film);
      enrichedMap.set(key, film);
    });

    // Merge enriched data into films
    return films.map(film => {
      const key = this.getFilmKey(film);
      const enriched = enrichedMap.get(key);
      
      if (enriched) {
        // Merge: keep original film data but add enriched fields
        return {
          ...film,
          posterUrl: enriched.posterUrl || film.posterUrl,
          plot: enriched.plot,
          director: enriched.director,
          cast: enriched.cast,
          genre: enriched.genre,
          rating: enriched.rating,
          runtime: enriched.runtime,
          trailerUrl: enriched.trailerUrl,
        };
      }
      
      return film;
    });
  }

  /**
   * Get a unique key for a film (title + year)
   */
  private getFilmKey(film: Film): string {
    return `${film.title.toLowerCase().trim()}-${film.year || 'unknown'}`;
  }

  /**
   * Get the oldest key from a cache map
   */
  private getOldestKey<T extends { timestamp: number }>(
    cache: Map<string, T>
  ): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, value] of cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.watchlistCache.clear();
    this.profileCache.clear();
    this.enrichedCache.clear();
  }

  /**
   * Clear only enriched cache (to free up memory, keeping watchlist data)
   */
  clearEnrichedCache(): void {
    this.enrichedCache.clear();
  }

  /**
   * Get cache stats for debugging
   */
  getStats() {
    return {
      watchlistCount: this.watchlistCache.size,
      profileCount: this.profileCache.size,
      enrichedCount: this.enrichedCache.size,
    };
  }
}

// Export singleton instance
export const sessionCache = new SessionCache();

