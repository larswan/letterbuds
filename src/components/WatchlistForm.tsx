import { useState, FormEvent } from 'react';
import '../styles/components/_form.scss';

interface WatchlistFormProps {
  onSubmit: (username1: string, username2: string) => void;
  isLoading: boolean;
}

export function WatchlistForm({ onSubmit, isLoading }: WatchlistFormProps) {
  const [username1, setUsername1] = useState('');
  const [username2, setUsername2] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (username1.trim() && username2.trim()) {
      onSubmit(username1.trim(), username2.trim());
    }
  };

  return (
    <form className="watchlist-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="username1">First Username</label>
        <input
          id="username1"
          type="text"
          value={username1}
          onChange={(e) => setUsername1(e.target.value)}
          placeholder="Enter Letterboxd username"
          disabled={isLoading}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="username2">Second Username</label>
        <input
          id="username2"
          type="text"
          value={username2}
          onChange={(e) => setUsername2(e.target.value)}
          placeholder="Enter Letterboxd username"
          disabled={isLoading}
          required
        />
      </div>
      <button type="submit" className="match-button" disabled={isLoading}>
        {isLoading ? 'Matching...' : 'Match'}
      </button>
    </form>
  );
}

