import { useState } from 'react';
import { WatchlistForm } from './components/WatchlistForm';
import { MatchResults } from './components/MatchResults';
import { LoadingSpinner } from './components/LoadingSpinner';
import { fetchWatchlist } from './services/letterboxdService';
import { findCommonFilms } from './services/matchService';
import { MatchResult } from './types';
import './styles/main.scss';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usernames, setUsernames] = useState<{ user1: string; user2: string } | null>(null);

  const handleSubmit = async (username1: string, username2: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setUsernames({ user1: username1, user2: username2 });

    try {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [COMPARE] Starting comparison for ${username1} and ${username2}`);

      // Fetch both watchlists in parallel
      const [films1, films2] = await Promise.all([
        fetchWatchlist(username1),
        fetchWatchlist(username2),
      ]);

      // Find common films
      const matchResult = findCommonFilms(films1, films2, username1, username2);
      setResult(matchResult);
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
    setUsernames(null);
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
          <WatchlistForm onSubmit={handleSubmit} isLoading={isLoading} />
        )}

        {result && usernames && (
          <MatchResults
            result={result}
            username1={usernames.user1}
            username2={usernames.user2}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}

export default App;

