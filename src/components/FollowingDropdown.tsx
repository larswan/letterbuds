import { useState, useRef, useEffect } from 'react';
import { fetchFollowing } from '../services/letterboxdService';
import { FollowingUser, UserProfile } from '../types';
import '../styles/components/_following.scss';

interface FollowingDropdownProps {
  username: string;
  profile: UserProfile;
  onSelectUser: (user: FollowingUser) => void;
  disabled?: boolean;
}

export function FollowingDropdown({ username, onSelectUser, disabled }: FollowingDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggle = async () => {
    if (disabled) return;
    
    if (!isOpen && following.length === 0 && !isLoading) {
      // Fetch following list when opening for the first time
      setIsLoading(true);
      setError(null);
      
      try {
        const followingList = await fetchFollowing(username);
        setFollowing(followingList);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load following list';
        setError(errorMessage);
        console.error('Error fetching following:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    setIsOpen(!isOpen);
  };

  const handleSelect = (user: FollowingUser) => {
    onSelectUser(user);
    setIsOpen(false);
  };

  return (
    <div className="following-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className="following-dropdown-trigger"
        onClick={handleToggle}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>Find Friends</span>
        {isLoading && <span className="spinner-small"></span>}
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      
      {isOpen && (
        <div className="following-dropdown-menu" role="listbox">
          {isLoading && (
            <div className="following-loading">
              <span className="spinner"></span>
              <span>Loading friends...</span>
            </div>
          )}
          
          {error && (
            <div className="following-error">
              <p>{error}</p>
            </div>
          )}
          
          {!isLoading && !error && following.length === 0 && (
            <div className="following-empty">
              <p>No following users found</p>
            </div>
          )}
          
          {!isLoading && !error && following.length > 0 && (
            <ul className="following-list">
              {following.map((user) => (
                <li
                  key={user.username}
                  className="following-item"
                  role="option"
                  onClick={() => handleSelect(user)}
                >
                  {user.avatarUrl && (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="following-avatar"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <span className="following-username">{user.displayName || user.username}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

