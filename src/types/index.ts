export interface Film {
  title: string;
  year?: number;
  tmdbId?: number;
  posterUrl?: string;
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
}

export interface FollowingUser {
  username: string;
  avatarUrl: string | null;
  displayName?: string;
}

