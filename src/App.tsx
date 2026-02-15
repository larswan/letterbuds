import { useState } from 'react';
import { WatchlistForm } from './components/WatchlistForm';
import { MatchResults } from './components/MatchResults';
import { LoadingSpinner } from './components/LoadingSpinner';
import { fetchWatchlist, fetchUserProfile } from './services/letterboxdService';
import { findCommonFilmsMultiUser } from './services/matchService';
import { MultiUserMatchResult, UserProfile } from './types';
import './styles/main.scss';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MultiUserMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<(UserProfile | null)[]>([]);

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
        
        // Add delay between requests (except for the first one)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between users
        }
        
        try {
          // Fetch watchlist and profile in parallel for the same user
          const [films, profile] = await Promise.all([
            fetchWatchlist(username),
            fetchUserProfile(username),
          ]);
          
          userFilms.push({ username, films });
          userProfiles.push(profile);
        } catch (err) {
          // If one user fails, continue with others but log the error
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[${new Date().toISOString()}] [ERROR] Failed to fetch data for ${username}:`, errorMessage);
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error(`[${new Date().toISOString()}] [ERROR] Comparison failed:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    // Keep usernames and profiles so they're preserved in the form
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Letterboxd Buddy</h1>
        <p className="subtitle">Find common films in watchlists</p>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={handleReset}>Try Again</button>
          </div>
        )}

        {isLoading && <LoadingSpinner />}

        {!isLoading && !result && !error && (
          <WatchlistForm 
            onSubmit={handleSubmit} 
            isLoading={isLoading}
            initialUsernames={usernames}
            initialProfiles={profiles}
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

