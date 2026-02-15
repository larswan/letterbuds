import { useState, useEffect, FormEvent, KeyboardEvent } from 'react';
import { FaCheck, FaTimes, FaPlus, FaTimesCircle } from 'react-icons/fa';
import { fetchUserProfile } from '../services/letterboxdService';
import { UserProfile, FollowingUser } from '../types';
import { FollowingDropdown } from './FollowingDropdown';
import '../styles/components/_form.scss';

interface WatchlistFormProps {
  onSubmit: (usernames: string[]) => void;
  isLoading: boolean;
  initialUsernames?: string[];
  initialProfiles?: (UserProfile | null)[];
}

interface UserInput {
  id: string;
  username: string;
  validation: UserValidationState;
}

interface UserValidationState {
  isValidating: boolean;
  isValid: boolean | null; // null = not validated yet
  profile: UserProfile | null;
  error: string | null;
}

const STORAGE_KEY = 'letterboxd-usernames';
const MAX_USERS = 10;

function getStoredUsernames(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveUsername(username: string): void {
  if (!username.trim()) return;
  
  const usernames = getStoredUsernames();
  const trimmed = username.trim();
  
  // Remove if exists (case-insensitive), then add to front (most recent first)
  const filtered = usernames.filter(u => u.toLowerCase() !== trimmed.toLowerCase());
  const updated = [trimmed, ...filtered].slice(0, 10);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function WatchlistForm({ 
  onSubmit, 
  isLoading,
  initialUsernames = [],
  initialProfiles = [],
}: WatchlistFormProps) {
  const [userInputs, setUserInputs] = useState<UserInput[]>(() => {
    // Initialize with at least 2 users, or use initial values
    if (initialUsernames.length >= 2) {
      return initialUsernames.map((username, index) => ({
        id: `user-${index}`,
        username,
        validation: {
          isValidating: false,
          isValid: initialProfiles[index] ? true : null,
          profile: initialProfiles[index] || null,
          error: null,
        },
      }));
    }
    return [
      { id: 'user-0', username: '', validation: { isValidating: false, isValid: null, profile: null, error: null } },
      { id: 'user-1', username: '', validation: { isValidating: false, isValid: null, profile: null, error: null } },
    ];
  });
  const [suggestions, setSuggestions] = useState<string[]>(getStoredUsernames());
  const [nextId, setNextId] = useState(userInputs.length);

  // Update state when initial values change
  useEffect(() => {
    if (initialUsernames.length >= 2) {
      setUserInputs(initialUsernames.map((username, index) => ({
        id: `user-${index}`,
        username,
        validation: {
          isValidating: false,
          isValid: initialProfiles[index] ? true : null,
          profile: initialProfiles[index] || null,
          error: null,
        },
      })));
      setNextId(initialUsernames.length);
    }
  }, [initialUsernames, initialProfiles]);

  const validateUsername = async (username: string, userId: string) => {
    const trimmed = username.trim();
    if (!trimmed) {
      setUserInputs(prev => prev.map(input => 
        input.id === userId 
          ? { ...input, validation: { isValidating: false, isValid: null, profile: null, error: null } }
          : input
      ));
      return;
    }

    // Check for duplicates first
    const duplicateError = checkForDuplicates(trimmed, userId);
    if (duplicateError) {
      setUserInputs(prev => prev.map(input => 
        input.id === userId 
          ? { ...input, validation: { isValidating: false, isValid: false, profile: null, error: duplicateError } }
          : input
      ));
      return;
    }

    setUserInputs(prev => prev.map(input => 
      input.id === userId 
        ? { ...input, validation: { isValidating: true, isValid: null, profile: null, error: null } }
        : input
    ));

    try {
      const profile = await fetchUserProfile(trimmed, true);
      setUserInputs(prev => prev.map(input => 
        input.id === userId 
          ? { ...input, validation: { isValidating: false, isValid: true, profile, error: null } }
          : input
      ));
    } catch (error) {
      setUserInputs(prev => prev.map(input => 
        input.id === userId 
          ? { ...input, validation: { isValidating: false, isValid: false, profile: null, error: "Couldn't find a public user with this username" } }
          : input
      ));
    }
  };

  const handleBlur = (userId: string) => {
    const input = userInputs.find(u => u.id === userId);
    if (input) {
      validateUsername(input.username, userId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, userId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = userInputs.find(u => u.id === userId);
      if (input) {
        validateUsername(input.username, userId);
      }
    }
  };

  const checkForDuplicates = (value: string, userId: string): string | null => {
    const trimmedValue = value.trim().toLowerCase();
    if (!trimmedValue) return null;
    
    const duplicate = userInputs.find(
      u => u.id !== userId && u.username.trim().toLowerCase() === trimmedValue
    );
    
    if (duplicate) {
      return `${value.trim()} has already been added`;
    }
    return null;
  };

  const handleUsernameChange = (value: string, userId: string) => {
    const input = userInputs.find(u => u.id === userId);
    if (!input) return;

    const previousValue = input.username;
    const previousValueTrimmed = previousValue.trim().toLowerCase();
    
    setUserInputs(prev => prev.map(u => 
      u.id === userId ? { ...u, username: value } : u
    ));
    
    // Clear duplicate errors from other fields if they were duplicating the previous value
    if (previousValueTrimmed) {
      setUserInputs(prev => prev.map(u => {
        if (u.id !== userId && 
            u.validation.error?.includes('already been added') &&
            u.username.trim().toLowerCase() === previousValueTrimmed) {
          // Re-check this field for duplicates with the new value
          const newDuplicateError = checkForDuplicates(u.username, u.id);
          if (newDuplicateError) {
            return {
              ...u,
              validation: {
                ...u.validation,
                error: newDuplicateError,
                isValid: false
              }
            };
          } else {
            // No longer a duplicate, re-validate if it was valid before
            if (u.validation.isValid === true) {
              return u; // Keep it valid
            }
            return {
              ...u,
              validation: {
                isValidating: false,
                isValid: null,
                profile: null,
                error: null
              }
            };
          }
        }
        return u;
      }));
    }
    
    // Check for duplicates
    const duplicateError = checkForDuplicates(value, userId);
    if (duplicateError) {
      setUserInputs(prev => prev.map(u => 
        u.id === userId 
          ? { 
              ...u, 
              validation: { 
                isValidating: false, 
                isValid: false, 
                profile: null, 
                error: duplicateError 
              } 
            }
          : u
      ));
      return;
    }
    
    // Check if this looks like a selection from datalist
    const trimmedValue = value.trim();
    const isDatalistSelection = suggestions.some(
      suggestion => suggestion.toLowerCase() === trimmedValue.toLowerCase()
    );
    
    if (isDatalistSelection && previousValue !== value && trimmedValue) {
      setTimeout(() => {
        validateUsername(trimmedValue, userId);
      }, 100);
    } else {
      // Reset validation when user types manually (but keep duplicate errors)
      if (input.validation.isValid !== null && !input.validation.error?.includes('already been added')) {
        setUserInputs(prev => prev.map(u => 
          u.id === userId 
            ? { ...u, validation: { isValidating: false, isValid: null, profile: null, error: null } }
            : u
        ));
      }
    }
  };

  const addUser = () => {
    if (userInputs.length < MAX_USERS) {
      setUserInputs(prev => [...prev, {
        id: `user-${nextId}`,
        username: '',
        validation: { isValidating: false, isValid: null, profile: null, error: null },
      }]);
      setNextId(prev => prev + 1);
    }
  };

  const removeUser = (userId: string) => {
    if (userInputs.length > 2) {
      setUserInputs(prev => prev.filter(u => u.id !== userId));
    }
  };

  const handleSelectFollowingUser = (selectedUser: FollowingUser, fromUserId: string) => {
    // Find the next empty user field (excluding the one that triggered this)
    const emptyFieldIndex = userInputs.findIndex(
      (input) => input.id !== fromUserId && !input.username.trim()
    );

    if (emptyFieldIndex !== -1) {
      // Fill the empty field
      const targetId = userInputs[emptyFieldIndex].id;
      setUserInputs(prev => prev.map(input => 
        input.id === targetId
          ? {
              ...input,
              username: selectedUser.username,
              validation: {
                isValidating: false,
                isValid: true,
                profile: {
                  username: selectedUser.username,
                  avatarUrl: selectedUser.avatarUrl,
                },
                error: null,
              },
            }
          : input
      ));
    } else {
      // No empty field, add a new user
      if (userInputs.length < MAX_USERS) {
        setUserInputs(prev => [...prev, {
          id: `user-${nextId}`,
          username: selectedUser.username,
          validation: {
            isValidating: false,
            isValid: true,
            profile: {
              username: selectedUser.username,
              avatarUrl: selectedUser.avatarUrl,
            },
            error: null,
          },
        }]);
        setNextId(prev => prev + 1);
      }
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Check for duplicates before submitting
    const usernames = userInputs.map(u => u.username.trim().toLowerCase()).filter(u => u);
    const uniqueUsernames = new Set(usernames);
    if (usernames.length !== uniqueUsernames.size) {
      // There are duplicates, validate all fields to show errors
      userInputs.forEach(input => {
        if (input.username.trim()) {
          validateUsername(input.username, input.id);
        }
      });
      return;
    }
    
    const validUsers = userInputs.filter(u => u.validation.isValid === true);
    if (validUsers.length >= 2) {
      validUsers.forEach(u => saveUsername(u.username.trim()));
      setSuggestions(getStoredUsernames());
      onSubmit(validUsers.map(u => u.username.trim()));
    }
  };

  const allValid = userInputs.every(u => !u.username.trim() || u.validation.isValid === true);
  const hasAtLeastTwoValid = userInputs.filter(u => u.validation.isValid === true).length >= 2;

  return (
    <form className="watchlist-form" onSubmit={handleSubmit}>
      {userInputs.map((input, index) => (
        <div key={input.id} className="form-group">
          <label htmlFor={input.id}>
            {input.validation.isValid && input.validation.profile ? (
              <span className="label-with-avatar">
                {input.validation.profile.avatarUrl && (
                  <img 
                    src={input.validation.profile.avatarUrl} 
                    alt={input.validation.profile.username}
                    className="label-avatar"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <span>{input.validation.profile.username}</span>
              </span>
            ) : (
              index === 0 ? 'First Username' : index === 1 ? 'Second Username' : `Username ${index + 1}`
            )}
          </label>
          <div className="input-wrapper">
            <input
              id={input.id}
              type="text"
              list="username-suggestions"
              value={input.username}
              onChange={(e) => handleUsernameChange(e.target.value, input.id)}
              onBlur={() => handleBlur(input.id)}
              onKeyDown={(e) => handleKeyDown(e, input.id)}
              placeholder="Enter Letterboxd username"
              disabled={isLoading}
              required
              autoComplete="off"
              className={input.validation.isValid === true ? 'valid' : input.validation.isValid === false ? 'invalid' : ''}
            />
            {input.validation.isValidating && (
              <span className="input-icon validating">
                <span className="spinner"></span>
              </span>
            )}
            {input.validation.isValid === true && !input.validation.isValidating && (
              <span className="input-icon valid-icon">
                <FaCheck />
              </span>
            )}
            {input.validation.isValid === false && !input.validation.isValidating && (
              <span className="input-icon invalid-icon">
                <FaTimes />
              </span>
            )}
            {userInputs.length > 2 && (
              <button
                type="button"
                className="remove-user-button"
                onClick={() => removeUser(input.id)}
                disabled={isLoading}
                aria-label="Remove user"
              >
                <FaTimesCircle />
              </button>
            )}
          </div>
          {input.validation.error && (
            <div className="error-message" role="alert">
              {input.validation.error}
            </div>
          )}
          {input.validation.isValid === true && input.validation.profile && (
            <FollowingDropdown
              username={input.username}
              profile={input.validation.profile}
              onSelectUser={(user) => handleSelectFollowingUser(user, input.id)}
              disabled={isLoading}
            />
          )}
        </div>
      ))}
      
      {userInputs.length < MAX_USERS && (
        <button
          type="button"
          className="add-user-button"
          onClick={addUser}
          disabled={isLoading}
        >
          <FaPlus />
          <span>Add User</span>
        </button>
      )}
      
      <datalist id="username-suggestions">
        {suggestions.map((username, index) => (
          <option key={index} value={username} />
        ))}
      </datalist>
      
      <button 
        type="submit" 
        className="match-button" 
        disabled={isLoading || !allValid || !hasAtLeastTwoValid}
      >
        {isLoading ? 'Matching...' : 'Match'}
      </button>
    </form>
  );
}
