import { Film, MultiUserMatchResult, UserGroupMatch } from '../types';

// Helper function to generate all combinations of users (2 or more)
function generateCombinations<T>(items: T[], minSize: number = 2): T[][] {
  const combinations: T[][] = [];
  
  function combine(start: number, current: T[]) {
    if (current.length >= minSize) {
      combinations.push([...current]);
    }
    
    for (let i = start; i < items.length; i++) {
      current.push(items[i]);
      combine(i + 1, current);
      current.pop();
    }
  }
  
  combine(0, []);
  return combinations;
}

// Helper function to create a unique key for a film
function getFilmKey(film: Film): string {
  return film.tmdbId 
    ? `tmdb:${film.tmdbId}`
    : `${film.title.toLowerCase()}:${film.year || ''}`;
}

// Find common films across a group of users
function findCommonFilmsForGroup(
  userFilms: Array<{ username: string; films: Film[] }>,
  usernames: string[]
): Film[] {
  if (usernames.length === 0) return [];
  
  // Get films for each user in the group
  const groupFilms = usernames.map(username => {
    const userData = userFilms.find(u => u.username === username);
    return userData ? userData.films : [];
  }).filter(films => films.length > 0);
  
  if (groupFilms.length === 0) return [];
  
  // Start with the first user's films
  const firstUserFilms = groupFilms[0];
  const commonFilms: Film[] = [];
  
  // Check each film from the first user
  firstUserFilms.forEach(film => {
    const filmKey = getFilmKey(film);
    
    // Check if this film exists in all other users' lists
    const isCommon = groupFilms.slice(1).every(userFilms => {
      return userFilms.some(f => getFilmKey(f) === filmKey);
    });
    
    if (isCommon) {
      commonFilms.push(film);
    }
  });
  
  return commonFilms;
}

export function findCommonFilmsMultiUser(
  userFilms: Array<{ username: string; films: Film[] }>
): MultiUserMatchResult {
  const timestamp = new Date().toISOString();
  const usernames = userFilms.map(u => u.username);
  console.log(`[${timestamp}] [MATCH] Comparing watchlists for ${usernames.length} users: ${usernames.join(', ')}`);

  // Generate all combinations of 2 or more users
  const combinations = generateCombinations(usernames, 2);
  
  // Find common films for each combination
  const userGroups: UserGroupMatch[] = combinations.map(combo => {
    const commonFilms = findCommonFilmsForGroup(userFilms, combo);
    return {
      usernames: combo,
      commonFilms,
      filmCount: commonFilms.length,
    };
  });

  // Sort by: 1) number of users (descending), 2) number of films (descending)
  userGroups.sort((a, b) => {
    // First sort by number of users (more users first)
    if (a.usernames.length !== b.usernames.length) {
      return b.usernames.length - a.usernames.length;
    }
    // Then by number of films (more films first)
    return b.filmCount - a.filmCount;
  });

  // Create watchlist counts
  const userWatchlistCounts: Record<string, number> = {};
  userFilms.forEach(({ username, films }) => {
    userWatchlistCounts[username] = films.length;
  });

  // Don't filter - we'll handle 0-film groups in the UI
  console.log(`[${new Date().toISOString()}] [MATCH] Found ${userGroups.length} user group combinations`);
  
  return {
    userGroups,
    userWatchlistCounts,
  };
}

// Legacy function for backward compatibility
export function findCommonFilms(
  films1: Film[],
  films2: Film[],
  username1: string,
  username2: string
) {
  // This is kept for backward compatibility but should use findCommonFilmsMultiUser
  return findCommonFilmsMultiUser([
    { username: username1, films: films1 },
    { username: username2, films: films2 },
  ]);
}
