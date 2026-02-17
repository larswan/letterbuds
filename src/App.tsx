import { useState, useEffect } from 'react';
import { WatchlistForm } from './components/WatchlistForm';
import { MatchResults } from './components/MatchResults';
import { LoadingSpinner } from './components/LoadingSpinner';
import { fetchWatchlist, fetchUserProfile } from './services/letterboxdService';
import { findCommonFilmsMultiUser } from './services/matchService';
import { enrichFilms } from './services/filmEnrichmentService';
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
      setResult(matchResult);
      setProfiles(userProfiles);
      
      // Start enrichment in background (don't block UI) - only enrich common films
      enrichCommonFilmsInBackground(matchResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error(`[${new Date().toISOString()}] [ERROR] Comparison failed:`, err);
    } finally {
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
  const enrichCommonFilmsInBackground = async (matchResult: MultiUserMatchResult) => {
    // Collect all unique common films from all groups
    const commonFilmsSet = new Map<string, Film>();
    
    matchResult.userGroups.forEach(group => {
      group.commonFilms.forEach(film => {
        const key = `${film.title.toLowerCase().trim()}-${film.year || 'unknown'}`;
        if (!commonFilmsSet.has(key)) {
          commonFilmsSet.set(key, film);
        }
      });
    });
    
    const commonFilms = Array.from(commonFilmsSet.values());
    
    if (commonFilms.length === 0) {
      console.log(`[${new Date().toISOString()}] [ENRICH] No common films to enrich`);
      return;
    }
    
    // Check cache for enriched data first
    const cacheKey = `common-${matchResult.userGroups.map(g => g.usernames.sort().join('-')).sort().join('_')}`;
    let cachedEnriched = sessionCache.getEnrichedData(cacheKey);
    
    if (cachedEnriched) {
      console.log(`[${new Date().toISOString()}] [ENRICH] Using cached enriched data for ${cachedEnriched.length} films`);
      // Update result with cached enriched data
      setResult(prevResult => {
        if (!prevResult) return prevResult;
        
        return {
          ...prevResult,
          userGroups: prevResult.userGroups.map(group => ({
            ...group,
            commonFilms: sessionCache.mergeEnrichedDataIntoFilms(group.commonFilms, cachedEnriched!),
          })),
        };
      });
      return;
    }
    
    // Check if we need to enrich (some films might already be enriched)
    const filmsToEnrich = commonFilms.filter(film => !film.posterUrl && !film.plot && film.imdbId);
    
    if (filmsToEnrich.length === 0) {
      console.log(`[${new Date().toISOString()}] [ENRICH] No films need enrichment (missing IMDb IDs or already enriched)`);
      return;
    }
    
    console.log(`[${new Date().toISOString()}] [ENRICH] Starting background enrichment for ${filmsToEnrich.length} common films...`);
    
    try {
      // Enrich films that need it
      const enrichedFilms = await enrichFilms(filmsToEnrich);
      
      // Merge enriched data back into original common films
      const enrichedMap = new Map<string, Film>();
      enrichedFilms.forEach(film => {
        const key = `${film.title.toLowerCase().trim()}-${film.year || 'unknown'}`;
        enrichedMap.set(key, film);
      });
      
      const allEnrichedCommonFilms = commonFilms.map(film => {
        const key = `${film.title.toLowerCase().trim()}-${film.year || 'unknown'}`;
        const enriched = enrichedMap.get(key);
        return enriched ? { ...film, ...enriched } : film;
      });
      
      // Store enriched films in cache
      sessionCache.setEnrichedData(cacheKey, allEnrichedCommonFilms);
      
      // Save enriched data to server
      try {
        const saveResponse = await fetch('/api/enrich-and-save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: 'common-films',
            films: allEnrichedCommonFilms,
          }),
        });
        
        if (saveResponse.ok) {
          const saveData = await saveResponse.json();
          console.log(`[${new Date().toISOString()}] [ENRICH] Saved enriched data for ${saveData.filmCount} common films`);
        } else {
          console.warn(`[${new Date().toISOString()}] [ENRICH] Failed to save enriched data`);
        }
      } catch (saveError) {
        console.error(`[${new Date().toISOString()}] [ENRICH] Error saving enriched data:`, saveError);
      }
      
      // Update the result with enriched data
      setResult(prevResult => {
        if (!prevResult) return prevResult;
        
        return {
          ...prevResult,
          userGroups: prevResult.userGroups.map(group => ({
            ...group,
            commonFilms: sessionCache.mergeEnrichedDataIntoFilms(group.commonFilms, allEnrichedCommonFilms),
          })),
        };
      });
      
      console.log(`[${new Date().toISOString()}] [ENRICH] Background enrichment completed and UI updated`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [ENRICH] Error enriching common films:`, error);
    }
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

