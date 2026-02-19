import { useEffect, useState, useCallback } from 'react';
import { MultiUserMatchResult, Film, UserProfile } from '../types';
import { getFilmDetailsFromTMDB, TMDBFilmDetails } from '../services/filmEnrichmentService';
import { FilmModal } from './FilmModal';
import '../styles/components/_results.scss';

interface MatchResultsProps {
  result: MultiUserMatchResult;
  usernames: string[];
  profiles: (UserProfile | null)[];
  onReset: () => void;
}

const MODAL_CLOSE_DURATION_MS = 220;

export function MatchResults({ result, usernames, profiles, onReset }: MatchResultsProps) {
  const { userGroups, userWatchlistCounts } = result;
  const [selectedFilm, setSelectedFilm] = useState<Film | null>(null);
  const [modalDetails, setModalDetails] = useState<TMDBFilmDetails | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);

  const handleFilmClick = useCallback((film: Film) => {
    setSelectedFilm(film);
    setModalDetails(null);
    setModalLoading(true);
    getFilmDetailsFromTMDB(film).then((details) => {
      setModalDetails(details);
      setModalLoading(false);
    }).catch(() => {
      setModalLoading(false);
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalClosing(true);
    setTimeout(() => {
      setSelectedFilm(null);
      setModalDetails(null);
      setModalClosing(false);
    }, MODAL_CLOSE_DURATION_MS);
  }, []);

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

  // Dev only: log full enriched data for the first two movies displayed
  useEffect(() => {
    if (import.meta.env.DEV && userGroups.length > 0) {
      const firstGroupWithFilms = userGroups.find(g => g.commonFilms.length > 0);
      if (firstGroupWithFilms) {
        const firstTwo = firstGroupWithFilms.commonFilms.slice(0, 2);
        console.log('[MatchResults] First two films (full enriched data):', firstTwo);
      }
    }
  }, [userGroups]);

  return (
    <div className="match-results">
      <div className="results-header">
        <div className="results-header-title-row">
          <h2>Match Results</h2>
          <a href="#" className="compare-another-link" onClick={(e) => { e.preventDefault(); onReset(); }}>
            ← Compare another
          </a>
        </div>
        <button type="button" className="filter-genre-button">
          Filter Genre
        </button>
      </div>

      <div className="results-summary-wrap">
        <div className="results-summary">
          {usernames.map((username) => {
            const profile = profileMap.get(username);
            const count = userWatchlistCounts[username] || 0;
            const profileUrl = `https://letterboxd.com/${username}/`;
            const watchlistUrl = `https://letterboxd.com/${username}/watchlist/`;
            return (
              <div key={username} className="user-summary">
                <div className="user-summary-content">
                  <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="user-summary-profile-link">
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
                    <strong>{username}</strong>
                  </a>
                  <a href={watchlistUrl} target="_blank" rel="noopener noreferrer" className="user-count">
                    <span className="number">{count}</span>
                    <span className="count-label">films in watchlist</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
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
                        <h4 className="group-subheading">{userNames}</h4>
                      </div>
                      <div className="films-list">
                        {group.commonFilms.map((film, index) => (
                          <FilmCard key={index} film={film} onFilmClick={handleFilmClick} />
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

      {selectedFilm && (
        <FilmModal
          film={selectedFilm}
          details={modalDetails}
          loading={modalLoading}
          onClose={closeModal}
          isClosing={modalClosing}
        />
      )}
    </div>
  );
}

/**
 * Get poster URL at size suitable for display (up to ~240x360).
 * Uses w342 for TMDB images (sharp at 240px width), falls back to original URL.
 */
function getPosterUrl(posterUrl?: string): string | null {
  if (!posterUrl) return null;
  
  // If it's a TMDB URL, use w342 for good quality at 240px display width
  // TMDB URLs format: https://image.tmdb.org/t/p/{size}{poster_path}
  const tmdbPattern = /(https:\/\/image\.tmdb\.org\/t\/p\/)(w\d+|original)(.+)/;
  const match = posterUrl.match(tmdbPattern);
  
  if (match) {
    return `${match[1]}w342${match[3]}`;
  }
  
  // Not a TMDB URL, return as-is
  return posterUrl;
}

function FilmCard({ film, onFilmClick }: { film: Film; onFilmClick?: (film: Film) => void }) {
  const letterboxdUrl = film.cleanTitle 
    ? `https://letterboxd.com${film.cleanTitle}`
    : null;

  const posterUrl = getPosterUrl(film.posterUrl);
  const hasPoster = !!posterUrl;

  const cardContent = (
    <div className="film-card">
      <div className="film-poster-container">
        {hasPoster ? (
          <img 
            src={posterUrl} 
            alt={film.title}
            className="film-poster"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              // Show placeholder if image fails to load
              const container = (e.target as HTMLImageElement).parentElement;
              if (container) {
                const placeholder = document.createElement('div');
                placeholder.className = 'film-poster-placeholder';
                placeholder.textContent = 'No Poster';
                container.appendChild(placeholder);
              }
            }}
          />
        ) : (
          <div className="film-poster-placeholder">
            <span>No Poster</span>
          </div>
        )}
      </div>
      <div className="film-info">
        <h3 className="film-title">{film.title}</h3>
        {film.year && <p className="film-year">{film.year}</p>}
      </div>
    </div>
  );

  if (onFilmClick) {
    return (
      <button
        type="button"
        className="film-card-link film-card-button"
        onClick={() => onFilmClick(film)}
      >
        {cardContent}
      </button>
    );
  }

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
