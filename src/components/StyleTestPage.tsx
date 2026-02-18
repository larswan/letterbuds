/**
 * Style test page for the user-group section.
 * Real data from a recent fetch (nancopeland + larswan, 17 films).
 * Visit /style-test to view. Styles are in _style-test.scss (duplicated so changes don't affect main results).
 */
import '../styles/components/_style-test.scss';

// Real data from fetch: nancopeland + larswan, 17 films in common
const MOCK_GROUP = {
  filmCount: 17,
  usernames: 'nancopeland + larswan',
  films: [
    { title: 'Sunset Boulevard', year: 1950, posterUrl: 'https://image.tmdb.org/t/p/w342/zt8aQ6ksqK6p1AopC5zVTDS9pKT.jpg' },
    { title: 'Four Weddings and a Funeral', year: 1994, posterUrl: 'https://image.tmdb.org/t/p/w342/qa72G2VS0bpxms6yo0tI9vsHm2e.jpg' },
    { title: 'Videodrome', year: 1983, posterUrl: 'https://image.tmdb.org/t/p/w342/qqqkiZSU9EBGZ1KiDmfn07S7qvv.jpg' },
    { title: 'Synecdoche, New York', year: 2008, posterUrl: 'https://image.tmdb.org/t/p/w342/5UwdhrjXhUgsiDhe1dpS9z4yj7q.jpg' },
    { title: "I'm Still Here", year: 2024, posterUrl: 'https://image.tmdb.org/t/p/w342/gZnsMbhCvhzAQlKaVpeFRHYjGyb.jpg' },
    { title: 'Pieces of April', year: 2003, posterUrl: 'https://image.tmdb.org/t/p/w342/qm3jGZwz2UkwwEFEFzSot8T0pz1.jpg' },
    { title: 'The Cremator', year: 1969, posterUrl: 'https://image.tmdb.org/t/p/w342/9or2Jzw9HOE4gp9niwXBkZdpTVx.jpg' },
    { title: 'Memories of Murder', year: 2003, posterUrl: 'https://image.tmdb.org/t/p/w342/rxndHKwUeFgTHx0PuuhZS4dMtrB.jpg' },
    { title: 'Withnail & I', year: 1987, posterUrl: 'https://image.tmdb.org/t/p/w342/i18cIp8A10A2JgByrfA9oIC9299.jpg' },
    { title: 'Slums of Beverly Hills', year: 1998, posterUrl: 'https://image.tmdb.org/t/p/w342/bTY6I0Mju4vTRHGoTZrNtxtAlAO.jpg' },
    { title: 'Mulholland Drive', year: 2001, posterUrl: 'https://image.tmdb.org/t/p/w342/x7A59t6ySylr1L7aubOQEA480vM.jpg' },
    { title: 'Y Tu Mamá También', year: 2001, posterUrl: 'https://image.tmdb.org/t/p/w342/aj3rqjab8jfc2fWmcS3H3c5qbur.jpg' },
    { title: 'Portrait of a Lady on Fire', year: 2019, posterUrl: 'https://image.tmdb.org/t/p/w342/2LquGwEhbg3soxSCs9VNyh5VJd9.jpg' },
    { title: 'Prince of Broadway', year: 2008, posterUrl: 'https://image.tmdb.org/t/p/w342/6rcVFsEwOyXsG0e7L9ql6KEPGJX.jpg' },
    { title: 'Eyes Wide Shut', year: 1999, posterUrl: 'https://image.tmdb.org/t/p/w342/knEIz1eNGl5MQDbrEAVWA7iRqF9.jpg' },
    { title: "Babette's Feast", year: 1987, posterUrl: 'https://image.tmdb.org/t/p/w342/3ibptSbnAHd0SUBnOKapNZQBpCl.jpg' },
    { title: 'Incendies', year: 2010, posterUrl: 'https://image.tmdb.org/t/p/w342/yH6DAQVgbyj72S66gN4WWVoTjuf.jpg' },
  ],
};

export function StyleTestPage() {
  return (
    <div className="style-test-page">
      <div className="style-test-header">
        <h1>User group style test</h1>
        <p>Mock data from a recent fetch. Edit <code>_style-test.scss</code> to try layout/visual changes.</p>
        <a href="/" className="style-test-back">← Back to app</a>
      </div>

      <div className="style-test-user-group-section">
        <div className="style-test-user-group">
          <div className="style-test-group-heading">
            <span className="style-test-number">{MOCK_GROUP.filmCount}</span>
            <span className="style-test-count-label">films in common</span>
            <h4 className="style-test-group-subheading">{MOCK_GROUP.usernames}</h4>
          </div>
          <div className="style-test-films-list">
            {MOCK_GROUP.films.map((film, index) => (
              <a key={index} href="#" className="style-test-film-card-link" onClick={(e) => e.preventDefault()}>
                <div className="style-test-film-card">
                  {film.posterUrl ? (
                    <div className="style-test-film-poster-container">
                      <img src={film.posterUrl} alt={film.title} className="style-test-film-poster" />
                    </div>
                  ) : (
                    <div className="style-test-film-poster-container">
                      <div className="style-test-film-poster-placeholder">
                        <span>No Poster</span>
                      </div>
                    </div>
                  )}
                  <div className="style-test-film-info">
                    <h3 className="style-test-film-title">{film.title}</h3>
                    {film.year && <p className="style-test-film-year">{film.year}</p>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
