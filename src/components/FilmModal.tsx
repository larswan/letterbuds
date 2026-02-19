import { useEffect, useRef, useState } from 'react';
import { Film } from '../types';
import { TMDBFilmDetails } from '../services/filmEnrichmentService';
import '../styles/components/_film-modal.scss';

interface FilmModalProps {
  film: Film;
  details: TMDBFilmDetails | null;
  loading: boolean;
  onClose: () => void;
  isClosing?: boolean;
}

export function FilmModal({ film, details, loading, onClose, isClosing = false }: FilmModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [backdropImageLoaded, setBackdropImageLoaded] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    overlayRef.current?.focus({ preventScroll: true });
    return () => prevActive?.focus();
  }, []);

  // Reset backdrop loaded state when film/details change so new backdrop fades in
  useEffect(() => {
    setBackdropImageLoaded(false);
  }, [film, details?.backdropUrl]);

  const letterboxdUrl = film.cleanTitle
    ? `https://letterboxd.com${film.cleanTitle}`
    : null;

  const year = details?.releaseDate
    ? new Date(details.releaseDate).getFullYear()
    : film.year;
  const rating = details?.voteAverage != null
    ? `${Number(details.voteAverage).toFixed(1)}/10`
    : null;
  const runtime = details?.runtime ? `${details.runtime} min` : null;

  return (
    <div
      ref={overlayRef}
      className={`film-modal-overlay${isClosing ? ' film-modal-overlay--closing' : ''}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Film details"
      tabIndex={-1}
    >
      <div className="film-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="film-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {loading ? (
          <div className="film-modal-loading">Loading details…</div>
        ) : (
          <>
            <div className="film-modal-backdrop">
              {details?.backdropUrl ? (
                <img
                  src={details.backdropUrl}
                  alt=""
                  className={`film-modal-backdrop-img${backdropImageLoaded ? ' film-modal-backdrop-img--loaded' : ''}`}
                  decoding="async"
                  onLoad={() => setBackdropImageLoaded(true)}
                />
              ) : (
                <div className="film-modal-backdrop-placeholder" />
              )}
              <div className="film-modal-backdrop-shade" />
            </div>

            <div className="film-modal-body">
              <div className="film-modal-poster-row">
                {details?.posterUrl ? (
                  <img src={details.posterUrl} alt={film.title} className="film-modal-poster" />
                ) : (
                  <div className="film-modal-poster film-modal-poster-placeholder">No poster</div>
                )}
                <div className="film-modal-meta">
                  <h2 className="film-modal-title">{film.title}</h2>
                  {year && <p className="film-modal-year">{year}</p>}
                  {rating && <p className="film-modal-rating">Rating: {rating}</p>}
                  {runtime && <p className="film-modal-runtime">{runtime}</p>}
                  {details?.director && (
                    <p className="film-modal-director">Director: {details.director}</p>
                  )}
                  {details?.genres && details.genres.length > 0 && (
                    <p className="film-modal-genres">{details.genres.join(', ')}</p>
                  )}
                </div>
              </div>

              {details?.overview && (
                <div className="film-modal-synopsis">
                  <h3>Synopsis</h3>
                  <p>{details.overview}</p>
                </div>
              )}

              <div className="film-modal-actions">
                {details?.trailerUrl && (
                  <a
                    href={details.trailerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="film-modal-btn film-modal-btn-trailer"
                  >
                    <img src="/YouTube_play_icon_compressed.png" alt="" className="film-modal-btn-trailer-icon" />
                    Watch trailer
                  </a>
                )}
                {letterboxdUrl && (
                  <a
                    href={letterboxdUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="film-modal-btn film-modal-btn-letterboxd"
                  >
                    View on Letterboxd
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
