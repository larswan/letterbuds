import { useState, useEffect } from 'react';
import { WatchlistForm } from './components/WatchlistForm';
import { MatchResults } from './components/MatchResults';
import { LoadingSpinner } from './components/LoadingSpinner';
import { fetchWatchlist, fetchUserProfile } from './services/letterboxdService';
import { findCommonFilmsMultiUser } from './services/matchService';
import { enrichFilms, enrichFilmPosterFromTMDB } from './services/filmEnrichmentService';
import { sessionCache } from './services/cacheService';
import { MultiUserMatchResult, UserProfile, Film } from './types';
import './styles/main.scss';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MultiUserMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<(UserProfile | null)[]>([]);
  const [currentScrapingUsername, setCurrentScrapingUsername] = useState<string | undefined>(undefined);
  const [followingFeatureEnabled, setFollowingFeatureEnabled] = useState<boolean | null>(null); // null = testing, true/false = result
  const [formKey, setFormKey] = useState(0); // Key to force form remount on reset

  const handleSubmit = async (usernamesArray: string[]) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setUsernames(usernamesArray);

    try {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [COMPARE] Starting comparison for ${usernamesArray.length} users: ${usernamesArray.join(', ')}`);

      // Fetch watchlists and profiles sequentially with delays to avoid rate limiting
      const userFilms = [];
      const userProfiles: (UserProfile | null)[] = [];
      const failedUsers: string[] = [];
      const enrichmentQueue: Film[] = []; // Queue for films to enrich
      const enrichedFilmsCache = new Map<string, Film>(); // Cache for enriched films during scraping
      
      // Helper to find common films between current user and all previous users
      const findCommonFilmsAcrossUsers = (
        previousUsers: Array<{ username: string; films: Film[] }>,
        currentFilms: Film[]
      ): Film[] => {
        const commonFilms: Film[] = [];
        const previousFilmsSet = new Set<string>();
        
        // Create set of all previous users' films
        previousUsers.forEach(({ films }) => {
          films.forEach(film => {
            const key = film.tmdbId 
              ? `tmdb:${film.tmdbId}`
              : `${film.title.toLowerCase()}:${film.year || ''}`;
            previousFilmsSet.add(key);
          });
        });
        
        // Find films in current user's list that are also in previous users' lists
        currentFilms.forEach(film => {
          const key = film.tmdbId 
            ? `tmdb:${film.tmdbId}`
            : `${film.title.toLowerCase()}:${film.year || ''}`;
          if (previousFilmsSet.has(key)) {
            commonFilms.push(film);
          }
        });
        
        return commonFilms;
      };
      
      for (let i = 0; i < usernamesArray.length; i++) {
        const username = usernamesArray[i];
        setCurrentScrapingUsername(username);
        
        // Add delay between requests (except for the first one)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between users
        }
        
        try {
          // Check cache first
          let films = sessionCache.getWatchlist(username);
          let profile = sessionCache.getProfile(username);
          
          // Fetch from API if not in cache
          if (!films) {
            console.log(`[${new Date().toISOString()}] [CACHE] Cache miss for ${username} watchlist, fetching...`);
            films = await fetchWatchlist(username);
            sessionCache.setWatchlist(username, films);
          } else {
            console.log(`[${new Date().toISOString()}] [CACHE] Cache hit for ${username} watchlist (${films.length} films)`);
          }
          
          if (!profile) {
            console.log(`[${new Date().toISOString()}] [CACHE] Cache miss for ${username} profile, fetching...`);
            profile = await fetchUserProfile(username);
            sessionCache.setProfile(username, profile);
          } else {
            console.log(`[${new Date().toISOString()}] [CACHE] Cache hit for ${username} profile`);
          }
          
          userFilms.push({ username, films });
          userProfiles.push(profile);

          // Starting with 2nd user, find common films and queue for enrichment
          if (i > 0 && userFilms.length >= 2) {
            const previousFilms = userFilms.slice(0, -1); // All previous users
            const currentFilms = films;
            
            // Find films in common between current user and all previous users
            const commonFilms = findCommonFilmsAcrossUsers(previousFilms, currentFilms);
            
            // Queue films that need enrichment (have imdbId but no posterUrl)
            commonFilms.forEach(film => {
              if (film.imdbId && !film.posterUrl) {
                const key = `${film.title.toLowerCase()}-${film.year || ''}`;
                if (!enrichedFilmsCache.has(key)) {
                  enrichmentQueue.push(film);
                  enrichedFilmsCache.set(key, film);
                }
              }
            });
            
            if (commonFilms.length > 0) {
              console.log(`[${new Date().toISOString()}] [ENRICH] Found ${commonFilms.length} common films, ${enrichmentQueue.length} queued for enrichment`);
            }
          }
        } catch (err) {
          // If one user fails, continue with others but log the error
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          const errorDetails = err instanceof Error ? err.stack : String(err);
          console.error(`[${new Date().toISOString()}] [ERROR] Failed to fetch data for ${username}:`, errorMessage);
          console.error(`[${new Date().toISOString()}] [ERROR] Full error details for ${username}:`, errorDetails);
          console.error(`[${new Date().toISOString()}] [ERROR] Error object for ${username}:`, err);
          failedUsers.push(username);
          
          // Add empty data for this user so we can still process others
          userFilms.push({ username, films: [] });
          userProfiles.push(null);
        }
      }
      
      // Check if we got any valid data
      const validUsers = userFilms.filter(u => u.films.length > 0);
      if (validUsers.length < 2) {
        let errorMsg = `Need at least 2 users with valid watchlists. Only ${validUsers.length} user(s) had valid data.`;
        if (failedUsers.length > 0) {
          errorMsg += ` Failed to fetch: ${failedUsers.join(', ')}.`;
        }
        throw new Error(errorMsg);
      }
      
      // Warn if some users failed but we still have enough
      if (failedUsers.length > 0 && validUsers.length >= 2) {
        console.warn(`[${new Date().toISOString()}] [WARNING] Some users failed but continuing with ${validUsers.length} valid users. Failed: ${failedUsers.join(', ')}`);
      }

      // Find common films across all combinations
      const matchResult = findCommonFilmsMultiUser(userFilms);
      
      // Show results immediately (don't wait for enrichment)
      setResult(matchResult);
      setProfiles(userProfiles);
      setIsLoading(false);
      setCurrentScrapingUsername(undefined);
      
      // Start enrichment in background (don't block UI) - only enrich common films
      enrichCommonFilmsInBackground(matchResult, enrichmentQueue);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error(`[${new Date().toISOString()}] [ERROR] Comparison failed:`, err);
      setIsLoading(false);
      setCurrentScrapingUsername(undefined);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    // Keep usernames and profiles so they're preserved in the form
    // Increment formKey to ensure form updates with preserved validation state
    setFormKey(prev => prev + 1);
  };

  // Enrich only common films in background after results are shown
  const enrichCommonFilmsInBackground = async (
    matchResult: MultiUserMatchResult,
    initialQueue: Film[] = []
  ) => {
    // Collect all unique common films from all groups that need enrichment
    const filmsToEnrich = new Map<string, Film>();
    
    matchResult.userGroups.forEach(group => {
      group.commonFilms.forEach(film => {
        if (film.imdbId && !film.posterUrl) {
          const key = `${film.title.toLowerCase().trim()}-${film.year || 'unknown'}`;
          if (!filmsToEnrich.has(key)) {
            filmsToEnrich.set(key, film);
          }
        }
      });
    });
    
    // Add initial queue films
    initialQueue.forEach(film => {
      if (film.imdbId && !film.posterUrl) {
        const key = `${film.title.toLowerCase().trim()}-${film.year || 'unknown'}`;
        if (!filmsToEnrich.has(key)) {
          filmsToEnrich.set(key, film);
        }
      }
    });
    
    const films = Array.from(filmsToEnrich.values());
    
    if (films.length === 0) {
      console.log(`[${new Date().toISOString()}] [ENRICH] No common films need enrichment`);
      return;
    }
    
    console.log(`[${new Date().toISOString()}] [ENRICH] Starting background enrichment for ${films.length} common films...`);
    
    // Enrich films one by one and update UI as each completes
    for (let i = 0; i < films.length; i++) {
      const film = films[i];
      const filmKey = `${film.title.toLowerCase().trim()}-${film.year || 'unknown'}`;
      
      // Check cache first
      let enriched: Film | null = sessionCache.getEnrichedFilm(film);
      
      if (enriched && enriched.posterUrl) {
        console.log(`[${new Date().toISOString()}] [ENRICH] Using cached poster for "${film.title}" (${i + 1}/${films.length})`);
      } else {
        // Small delay to avoid rate limiting
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        console.log(`[${new Date().toISOString()}] [ENRICH] Fetching poster for "${film.title}" from TMDB (${i + 1}/${films.length})...`);
        enriched = await enrichFilmPosterFromTMDB(film);
        
        // Cache enriched film if successful
        if (enriched && enriched.posterUrl) {
          sessionCache.setEnrichedFilm(enriched);
        }
      }
      
      // Update result state with enriched film (if we got one)
      if (enriched && enriched.posterUrl) {
        setResult(prevResult => {
          if (!prevResult) return prevResult;
          
          return {
            ...prevResult,
            userGroups: prevResult.userGroups.map(group => ({
              ...group,
              commonFilms: group.commonFilms.map(f => {
                const fKey = `${f.title.toLowerCase().trim()}-${f.year || 'unknown'}`;
                return fKey === filmKey ? { ...f, posterUrl: enriched!.posterUrl } : f;
              }),
            })),
          };
        });
        
        console.log(`[${new Date().toISOString()}] [ENRICH] ✓ Poster loaded for "${film.title}" (${i + 1}/${films.length})`);
      } else {
        console.log(`[${new Date().toISOString()}] [ENRICH] ✗ No poster found for "${film.title}" (${i + 1}/${films.length})`);
      }
    }
    
    console.log(`[${new Date().toISOString()}] [ENRICH] Background enrichment completed`);
  };

  // Initialize following feature status - default to null (will be set by WatchlistForm)
  useEffect(() => {
    // Start with null (testing state) - WatchlistForm will test and update
    setFollowingFeatureEnabled(null);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <img 
            src="/letterboxd-dots-neg-tight.png" 
            alt="Letterboxd" 
            className="letterboxd-logo"
          />
          <h1>Letterbuds</h1>
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={handleReset}>Try Again</button>
          </div>
        )}

        {isLoading && <LoadingSpinner currentUsername={currentScrapingUsername} />}

        {!isLoading && !result && !error && (
          <WatchlistForm 
            key={`form-${formKey}-${usernames.join('-')}`}
            onSubmit={handleSubmit} 
            isLoading={isLoading}
            initialUsernames={usernames}
            initialProfiles={profiles}
            followingFeatureEnabled={followingFeatureEnabled}
            onFollowingFeatureStatusChange={setFollowingFeatureEnabled}
          />
        )}

        {result && usernames.length > 0 && (
          <MatchResults
            result={result}
            usernames={usernames}
            profiles={profiles}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}

export default App;

