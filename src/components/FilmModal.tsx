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
  const tmdbRating = details?.voteAverage != null
    ? `${Number(details.voteAverage).toFixed(1)}/10`
    : null;
  const externalRatings = details?.ratings || [];
  const showTmdbRating = externalRatings.length === 0 && !!tmdbRating;

  const renderRatingIcon = (source: string) => {
    if (source === 'TMDB') {
      return <img src="/tmdb-icon.jpeg" alt="TMDB" className="film-modal-rating-icon" />;
    }
    if (source === 'IMDb') {
      return <img src="/imdb-icon.png" alt="IMDb" className="film-modal-rating-icon" />;
    }
    if (source === 'Rotten Tomatoes') {
      return (
        <svg viewBox="0 0 80 80" className="film-modal-rating-icon film-modal-rating-icon-svg" aria-label="Rotten Tomatoes Critic" role="img">
          <path d="M77.0137759,27.0426556 C76.2423237,14.6741909 69.9521992,5.42041494 60.4876349,0.246970954 C60.5414108,0.548381743 60.273195,0.925145228 59.9678008,0.791701245 C53.7772614,-1.91634855 43.2753527,6.84780083 35.9365975,2.25825726 C35.9917012,3.90539419 35.6700415,11.940249 24.3515353,12.4063071 C24.0843154,12.4172614 23.9372614,12.1443983 24.1062241,11.9512033 C25.619917,10.2247303 27.1482158,5.85360996 24.9507054,3.5233195 C20.2446473,7.74041494 17.5117012,9.32746888 8.48829876,7.23319502 C2.71103734,13.2740249 -0.562655602,21.5419087 0.08,31.8413278 C1.39120332,52.86639 21.0848133,64.8846473 40.9165145,63.6471369 C60.746888,62.4106224 78.3253112,48.0677178 77.0137759,27.0426556" fill="#FA320A"></path>
        </svg>
      );
    }
    if (source === 'Rotten Tomatoes Audience') {
      return (
        <svg viewBox="0 0 80 80" className="film-modal-rating-icon film-modal-rating-icon-svg" aria-label="Rotten Tomatoes Audience" role="img">
          <path d="M50.9736803,68.1576208 C49.8275093,69.89829 47.6002974,71.7008178 45.2692937,72.9026022 L49.2541264,32.4853532 C51.7894424,31.6707807 54.2634944,30.5915242 56.085948,29.0438662 L50.9736803,68.1576208 Z M41.3037918,74.5885502 C37.4450558,75.8655762 35.201487,76.2614126 31.9895911,76.5766543 L32.4901115,35.0432714 C36.0383643,34.9415613 40.6301859,34.4606691 44.5427509,33.6255762 L41.3037918,74.5885502 Z M18.29829,74.5885502 L15.0596283,33.6255762 C18.9718959,34.4606691 23.5637175,34.9415613 27.1119703,35.0432714 L27.6124907,76.5766543 C24.4005948,76.2614126 22.1573234,75.8655762 18.29829,74.5885502 Z M8.62869888,68.1576208 L3.51613383,29.0438662 C5.33858736,30.5915242 7.81263941,31.6707807 10.3479554,32.4853532 L14.3327881,72.9026022 C12.0017844,71.7008178 9.77457249,69.89829 8.62869888,68.1576208 Z M50.687881,13.6110037 C50.7384387,13.8578439 50.7666914,14.1130112 50.7681784,14.3750186 C50.7696654,14.64 50.7440892,14.8990335 50.6950186,15.1494424 C52.5460223,15.4465428 53.9663941,17.0411896 53.9773978,18.9778439 C53.9779926,19.0991822 53.9714498,19.2193309 53.9613383,19.3379926 C54.904684,19.463197 55.7421561,19.9253532 56.3485502,20.5992565 C53.6877323,24.6402974 42.8237918,27.7159851 29.8010409,27.790632 C14.8895167,27.8759851 2.76193309,23.9952416 2.53115242,19.0985874 C2.56386617,19.063197 2.59390335,19.0251301 2.62810409,18.9909294 C2.39791822,18.5983643 2.23910781,18.1608922 2.15702602,17.6966543 C0.729219331,19.0518959 -0.13472119,20.1445353 0.0172490706,21.7356134 C0.0318215613,21.9482528 6.3339777,67.0709294 6.3339777,67.0709294 C7.06111524,74.2173978 17.4388104,79.9292193 29.8010409,80 C42.1632714,79.9292193 52.5412639,74.2173978 53.2681041,67.0709294 C53.2681041,67.0709294 59.5702602,21.9482528 59.5848327,21.7356134 C59.8866914,18.5531599 56.162974,15.6642379 50.687881,13.6110037 L50.687881,13.6110037 Z" fill="#DB382A"></path>
        </svg>
      );
    }
    return null;
  };

  const runtime = details?.runtime ? `${details.runtime} minutes` : null;

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
                  {runtime && <p className="film-modal-runtime">{runtime}</p>}
                  {details?.genres && details.genres.length > 0 && (
                    <p className="film-modal-genres">{details.genres.join(', ')}</p>
                  )}
                  {details?.director && (
                    <p className="film-modal-director">Directed by {details.director}</p>
                  )}
                  {details?.writer && (
                    <p className="film-modal-writer">Written by {details.writer}</p>
                  )}
                  {details?.cast && details.cast.length > 0 && (
                    <p className="film-modal-cast">Starring: {details.cast.join(', ')}</p>
                  )}

                  <div className="film-modal-ratings-row">
                    {showTmdbRating && (
                      <div className="film-modal-rating">
                        {renderRatingIcon('TMDB')}
                        <span className="film-modal-rating-value">{tmdbRating}</span>
                      </div>
                    )}
                    {externalRatings.map((rating) => (
                      <div key={`${rating.source}-${rating.value}`} className="film-modal-rating">
                        {renderRatingIcon(rating.source)}
                        <span className="film-modal-rating-value">{rating.value}</span>
                      </div>
                    ))}
                  </div>
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
                    <img src="/letterboxd-dots-neg-tight.png" alt="" className="film-modal-btn-letterboxd-icon" />
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
