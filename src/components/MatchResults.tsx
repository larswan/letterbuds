import { MatchResult, Film } from '../types';
import '../styles/components/_results.scss';

interface MatchResultsProps {
  result: MatchResult;
  username1: string;
  username2: string;
  onReset: () => void;
}

export function MatchResults({ result, username1, username2, onReset }: MatchResultsProps) {
  const { commonFilms, counts } = result;

  return (
    <div className="match-results">
      <div className="results-header">
        <h2>Match Results</h2>
        <button className="reset-button" onClick={onReset}>
          Compare Another
        </button>
      </div>

      <div className="results-summary">
        <p>
          <strong>{username1}</strong> has <strong>{counts.user1}</strong> films in watchlist
        </p>
        <p>
          <strong>{username2}</strong> has <strong>{counts.user2}</strong> films in watchlist
        </p>
        <p className="common-count">
          <strong>{counts.common}</strong> {counts.common === 1 ? 'film' : 'films'} in common
        </p>
      </div>

      {commonFilms.length === 0 ? (
        <div className="no-results">
          <p>No common films found in watchlists.</p>
        </div>
      ) : (
        <div className="films-list">
          {commonFilms.map((film, index) => (
            <FilmCard key={index} film={film} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilmCard({ film }: { film: Film }) {
  return (
    <div className="film-card">
      {film.posterUrl && (
        <img 
          src={film.posterUrl} 
          alt={film.title}
          className="film-poster"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <div className="film-info">
        <h3 className="film-title">{film.title}</h3>
        {film.year && <p className="film-year">{film.year}</p>}
      </div>
    </div>
  );
}

