import { MultiUserMatchResult, Film, UserProfile } from '../types';
import '../styles/components/_results.scss';

interface MatchResultsProps {
  result: MultiUserMatchResult;
  usernames: string[];
  profiles: (UserProfile | null)[];
  onReset: () => void;
}

export function MatchResults({ result, usernames, profiles, onReset }: MatchResultsProps) {
  const { userGroups, userWatchlistCounts } = result;

  // Group results by number of users
  const groupsByUserCount = userGroups.reduce((acc, group) => {
    const count = group.usernames.length;
    if (!acc[count]) {
      acc[count] = [];
    }
    acc[count].push(group);
    return acc;
  }, {} as Record<number, typeof userGroups>);

  // Sort user counts descending (more users first)
  const sortedUserCounts = Object.keys(groupsByUserCount)
    .map(Number)
    .sort((a, b) => b - a);

  // Get profile map for easy lookup
  const profileMap = new Map<string, UserProfile | null>();
  usernames.forEach((username, index) => {
    profileMap.set(username, profiles[index] || null);
  });

  return (
    <div className="match-results">
      <div className="results-header">
        <h2>Match Results</h2>
        <button className="reset-button" onClick={onReset}>
          Compare Another
        </button>
      </div>

      <div className="results-summary">
        {usernames.map((username) => {
          const profile = profileMap.get(username);
          const count = userWatchlistCounts[username] || 0;
          return (
            <div key={username} className="user-summary">
              {profile?.avatarUrl && (
                <img 
                  src={profile.avatarUrl} 
                  alt={username}
                  className="user-avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="user-summary-content">
                <strong>{username}</strong>
                <div className="user-count">
                  <span className="number">{count}</span>
                  <span className="count-label">films in watchlist</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {userGroups.length === 0 ? (
        <div className="no-results">
          <p>No common films found in watchlists.</p>
        </div>
      ) : (
        <div className="films-list-grouped">
          {sortedUserCounts.map(userCount => {
            const groups = groupsByUserCount[userCount];
            // Sort groups by film count (descending)
            const sortedGroups = [...groups].sort((a, b) => b.filmCount - a.filmCount);

            return (
              <div key={userCount} className="user-group-section">
                {sortedGroups.map((group, groupIndex) => {
                  const userNames = group.usernames.join(' + ');
                  
                  if (group.filmCount === 0) {
                    return (
                      <div key={groupIndex} className="user-group user-group-empty">
                        <h4 className="group-subheading">{userNames}</h4>
                        <p className="no-films-message">have 0 films in common</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={groupIndex} className="user-group">
                      <div className="group-heading">
                        <span className="number">{group.filmCount}</span>
                        <span className="count-label">{group.filmCount === 1 ? 'film' : 'films'} in common</span>
                      </div>
                      <h4 className="group-subheading">{userNames}</h4>
                      <div className="films-list">
                        {group.commonFilms.map((film, index) => (
                          <FilmCard key={index} film={film} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Get appropriately sized poster URL for small containers (< 250x300)
 * Uses w185 size for TMDB images, falls back to original URL
 */
function getPosterUrl(posterUrl?: string): string | null {
  if (!posterUrl) return null;
  
  // If it's a TMDB URL, replace with w185 size for smaller containers
  // TMDB URLs format: https://image.tmdb.org/t/p/{size}{poster_path}
  const tmdbPattern = /(https:\/\/image\.tmdb\.org\/t\/p\/)(w\d+|original)(.+)/;
  const match = posterUrl.match(tmdbPattern);
  
  if (match) {
    // Replace size with w185 for smaller containers
    return `${match[1]}w185${match[3]}`;
  }
  
  // Not a TMDB URL, return as-is
  return posterUrl;
}

function FilmCard({ film }: { film: Film }) {
  const letterboxdUrl = film.cleanTitle 
    ? `https://letterboxd.com${film.cleanTitle}`
    : null;

  const posterUrl = getPosterUrl(film.posterUrl);

  const cardContent = (
    <div className="film-card">
      {posterUrl && (
        <div className="film-poster-container">
          <img 
            src={posterUrl} 
            alt={film.title}
            className="film-poster"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      <div className="film-info">
        <h3 className="film-title">{film.title}</h3>
        {film.year && <p className="film-year">{film.year}</p>}
      </div>
    </div>
  );

  if (letterboxdUrl) {
    return (
      <a 
        href={letterboxdUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="film-card-link"
      >
        {cardContent}
      </a>
    );
  }

  return cardContent;
}
