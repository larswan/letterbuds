import { Film, MatchResult } from '../types';

export function findCommonFilms(
  films1: Film[],
  films2: Film[],
  username1: string,
  username2: string
): MatchResult {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MATCH] Comparing watchlists for ${username1} and ${username2}...`);

  // Create a set for faster lookup
  // Match by TMDB ID if available, otherwise by title + year
  const filmSet = new Set<string>();
  
  // Add films from first list to set
  films1.forEach(film => {
    const key = film.tmdbId 
      ? `tmdb:${film.tmdbId}`
      : `${film.title.toLowerCase()}:${film.year || ''}`;
    filmSet.add(key);
  });

  // Find common films
  const commonFilms: Film[] = [];
  films2.forEach(film => {
    const key = film.tmdbId 
      ? `tmdb:${film.tmdbId}`
      : `${film.title.toLowerCase()}:${film.year || ''}`;
    
    if (filmSet.has(key)) {
      // Use the film from the first list (or second, doesn't matter)
      commonFilms.push(film);
    }
  });

  const result: MatchResult = {
    commonFilms,
    counts: {
      user1: films1.length,
      user2: films2.length,
      common: commonFilms.length,
    },
  };

  console.log(`[${new Date().toISOString()}] [MATCH] Found ${result.counts.common} common films between ${username1} and ${username2}`);
  
  return result;
}

