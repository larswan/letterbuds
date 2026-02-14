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

