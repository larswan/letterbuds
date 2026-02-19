export interface Film {
  title: string;
  year?: number;
  tmdbId?: number;
  posterUrl?: string;
  imdbId?: string;
  cleanTitle?: string; // For Letterboxd links
  // Enriched data from OMDb
  plot?: string;
  director?: string;
  cast?: string[];
  genre?: string[];
  rating?: string;
  runtime?: string;
  // Enriched data from TMDB (for trailers)
  trailerUrl?: string;
}

export interface WatchlistResponse {
  movies: Film[];
}

export interface MatchResult {
  commonFilms: Film[];
  counts: {
    user1: number;
    user2: number;
    common: number;
  };
}

export interface UserGroupMatch {
  usernames: string[];
  commonFilms: Film[];
  filmCount: number;
}

export interface MultiUserMatchResult {
  userGroups: UserGroupMatch[];
  userWatchlistCounts: Record<string, number>;
}

export interface UserProfile {
  username: string;
  avatarUrl: string | null;
  hasWatchlist?: boolean;
}

export interface FollowingUser {
  username: string;
  avatarUrl: string | null;
  displayName?: string;
}

