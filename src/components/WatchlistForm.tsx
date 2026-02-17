import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import { FaCheck, FaTimes, FaPlus } from 'react-icons/fa';
import { fetchUserProfile } from '../services/letterboxdService';
import { UserProfile, FollowingUser } from '../types';
import { FollowingDropdown } from './FollowingDropdown';
import '../styles/components/_form.scss';

interface WatchlistFormProps {
  onSubmit: (usernames: string[]) => void;
  isLoading: boolean;
  initialUsernames?: string[];
  initialProfiles?: (UserProfile | null)[];
  followingFeatureEnabled?: boolean | null; // null = testing, true/false = result
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
  lastValidatedValue: string | null; // Track what was last validated to avoid re-checking
}

const STORAGE_KEY = 'letterboxd-usernames';
const MAX_USERS = 10;

function getOrdinalName(index: number): string {
  const ordinals = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];
  return ordinals[index] || `${index + 1}th`;
}

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
  followingFeatureEnabled = null,
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
          lastValidatedValue: initialProfiles[index] ? username.trim() : null,
        },
      }));
    }
    return [
      { id: 'user-0', username: '', validation: { isValidating: false, isValid: null, profile: null, error: null, lastValidatedValue: null } },
      { id: 'user-1', username: '', validation: { isValidating: false, isValid: null, profile: null, error: null, lastValidatedValue: null } },
    ];
  });
  const [suggestions, setSuggestions] = useState<string[]>(getStoredUsernames());
  const [nextId, setNextId] = useState(userInputs.length);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const [openFollowingDropdown, setOpenFollowingDropdown] = useState<string | null>(null);
  
  // Debounce timers for each input
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const dropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Update state when initial values change
  useEffect(() => {
    if (initialUsernames.length >= 2) {
      // Always update to ensure validation state is preserved when resetting
      setUserInputs(initialUsernames.map((username, index) => ({
        id: `user-${index}`,
        username,
        validation: {
          isValidating: false,
          isValid: initialProfiles[index] ? true : null,
          profile: initialProfiles[index] || null,
          error: null,
          lastValidatedValue: initialProfiles[index] ? username.trim() : null,
        },
      })));
      setNextId(initialUsernames.length);
    }
  }, [initialUsernames, initialProfiles]);
  
  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach(timer => clearTimeout(timer));
      debounceTimers.current.clear();
    };
  }, []);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (activeDropdown) {
        const dropdown = dropdownRefs.current.get(activeDropdown);
        const target = event.target as Node;
        if (dropdown && !dropdown.contains(target)) {
          const input = document.getElementById(activeDropdown);
          if (input && !input.contains(target)) {
            setActiveDropdown(null);
            setSelectedSuggestionIndex(-1);
          }
        }
      }
    }
    
    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeDropdown]);

  const validateUsername = async (username: string, userId: string, skipIfAlreadyValidated: boolean = false, showErrors: boolean = true) => {
    const trimmed = username.trim();
    const input = userInputs.find(u => u.id === userId);
    
    if (!input) return;
    
    // If empty, clear validation
    if (!trimmed) {
      setUserInputs(prev => prev.map(input => 
        input.id === userId 
          ? { ...input, validation: { isValidating: false, isValid: null, profile: null, error: null, lastValidatedValue: null } }
          : input
      ));
      return;
    }

    // Skip validation if already validated with the same value
    if (skipIfAlreadyValidated && 
        input.validation.lastValidatedValue === trimmed && 
        input.validation.isValid === true) {
      return;
    }

    // Check for duplicates first
    const duplicateError = checkForDuplicates(trimmed, userId);
    if (duplicateError) {
      if (showErrors) {
        setUserInputs(prev => prev.map(input => 
          input.id === userId 
            ? { ...input, validation: { isValidating: false, isValid: false, profile: null, error: duplicateError, lastValidatedValue: null } }
            : input
        ));
      } else {
        // Silent validation failure - don't set invalid state
        setUserInputs(prev => prev.map(input => 
          input.id === userId 
            ? { ...input, validation: { isValidating: false, isValid: null, profile: null, error: null, lastValidatedValue: null } }
            : input
        ));
      }
      return;
    }

    // Clear any previous errors and start validating
    setUserInputs(prev => prev.map(input => 
      input.id === userId 
        ? { ...input, validation: { isValidating: true, isValid: null, profile: null, error: null, lastValidatedValue: null } }
        : input
    ));

    try {
      const profile = await fetchUserProfile(trimmed, true);
      setUserInputs(prev => prev.map(input => 
        input.id === userId 
          ? { ...input, validation: { isValidating: false, isValid: true, profile, error: null, lastValidatedValue: trimmed } }
          : input
      ));
    } catch (error) {
      // Only set invalid state and error if showErrors is true
      if (showErrors) {
        setUserInputs(prev => prev.map(input => 
          input.id === userId 
            ? { ...input, validation: { isValidating: false, isValid: false, profile: null, error: "Couldn't find a public user with this username", lastValidatedValue: trimmed } }
            : input
        ));
      } else {
        // Silent validation failure - don't set invalid state, just clear validating
        setUserInputs(prev => prev.map(input => 
          input.id === userId 
            ? { ...input, validation: { isValidating: false, isValid: null, profile: null, error: null, lastValidatedValue: null } }
            : input
        ));
      }
    }
  };

  const handleBlur = (userId: string) => {
    const input = userInputs.find(u => u.id === userId);
    if (input) {
      const trimmed = input.username.trim();
      // Only validate if the value has changed from what was last validated
      if (trimmed && input.validation.lastValidatedValue !== trimmed) {
        // Clear any pending debounce timer
        const timer = debounceTimers.current.get(userId);
        if (timer) {
          clearTimeout(timer);
          debounceTimers.current.delete(userId);
        }
        validateUsername(trimmed, userId, false, true); // showErrors: true for user-triggered
      }
    }
  };

  // Get filtered suggestions for an input
  const getFilteredSuggestions = (value: string, currentUserId: string): string[] => {
    const trimmed = value.trim().toLowerCase();
    
    // Get all usernames currently in other fields (case-insensitive)
    const existingUsernames = new Set(
      userInputs
        .filter(input => input.id !== currentUserId && input.username.trim())
        .map(input => input.username.trim().toLowerCase())
    );
    
    // Filter suggestions: match the value AND not already in another field
    let filtered = suggestions.filter(s => {
      const suggestionLower = s.toLowerCase();
      const matchesValue = !trimmed || suggestionLower.includes(trimmed);
      const notInOtherFields = !existingUsernames.has(suggestionLower);
      return matchesValue && notInOtherFields;
    });
    
    return filtered;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, userId: string) => {
    const input = userInputs.find(u => u.id === userId);
    if (!input) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && activeDropdown === userId) {
        // Select the highlighted suggestion
        const filtered = getFilteredSuggestions(input.username, userId);
        if (filtered[selectedSuggestionIndex]) {
          handleUsernameChange(filtered[selectedSuggestionIndex], userId);
          setActiveDropdown(null);
          setSelectedSuggestionIndex(-1);
        }
      } else {
        validateUsername(input.username, userId, false, true); // showErrors: true for user-triggered
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const filtered = getFilteredSuggestions(input.username, userId);
      if (filtered.length > 0) {
        setActiveDropdown(userId);
        setSelectedSuggestionIndex(prev => 
          prev < filtered.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeDropdown === userId && selectedSuggestionIndex >= 0) {
        const filtered = getFilteredSuggestions(input.username, userId);
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : filtered.length - 1
        );
      }
    } else if (e.key === 'Escape') {
      setActiveDropdown(null);
      setSelectedSuggestionIndex(-1);
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
    
    // Reset suggestion selection when typing
    setSelectedSuggestionIndex(-1);
    
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
            // No longer a duplicate, keep validation if it was valid
            return u;
          }
        }
        return u;
      }));
    }
    
    // Check for duplicates immediately
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
                error: duplicateError,
                lastValidatedValue: null
              } 
            }
          : u
      ));
      return;
    }
    
    // Clear any previous errors when user types (but don't clear if already validated with same value)
    const trimmedValue = value.trim();
    const isSameAsValidated = input.validation.lastValidatedValue === trimmedValue && input.validation.isValid === true;
    
    if (!isSameAsValidated) {
      // Clear validation state when user types (but don't show error yet)
      setUserInputs(prev => prev.map(u => 
        u.id === userId 
          ? { 
              ...u, 
              validation: { 
                isValidating: false, 
                isValid: null, 
                profile: null, 
                error: null,
                lastValidatedValue: null
              } 
            }
          : u
      ));
    }
    
    // Clear any existing debounce timer for this input
    const existingTimer = debounceTimers.current.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set up debounced validation (0.5 seconds after user stops typing)
    if (trimmedValue) {
      const timer = setTimeout(() => {
        validateUsername(trimmedValue, userId, true, false); // showErrors: false for automatic debounced validation
        debounceTimers.current.delete(userId);
      }, 500); // 0.5 seconds debounce
      
      debounceTimers.current.set(userId, timer);
    } else {
      // Clear validation if input is empty
      setUserInputs(prev => prev.map(u => 
        u.id === userId 
          ? { ...u, validation: { isValidating: false, isValid: null, profile: null, error: null, lastValidatedValue: null } }
          : u
      ));
    }
  };

  const addUser = () => {
    if (userInputs.length < MAX_USERS) {
      setUserInputs(prev => [...prev, {
        id: `user-${nextId}`,
        username: '',
        validation: { isValidating: false, isValid: null, profile: null, error: null, lastValidatedValue: null },
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
                lastValidatedValue: selectedUser.username,
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
            lastValidatedValue: selectedUser.username,
          },
        }]);
        setNextId(prev => prev + 1);
      }
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Get only validated users (ignore empty fields)
    const validUsers = userInputs.filter(u => u.validation.isValid === true);
    
    // Check for duplicates among validated users
    const usernames = validUsers.map(u => u.username.trim().toLowerCase());
    const uniqueUsernames = new Set(usernames);
    if (usernames.length !== uniqueUsernames.size) {
      // There are duplicates, validate all fields to show errors
      userInputs.forEach(input => {
        if (input.username.trim()) {
          validateUsername(input.username, input.id, false, true); // showErrors: true for form submit
        }
      });
      return;
    }
    
    // If we have at least 2 validated users, proceed (ignore empty fields)
    if (validUsers.length >= 2) {
      // Remove empty/invalid fields from the form (close them)
      setUserInputs(prev => {
        const filtered = prev.filter(u => u.validation.isValid === true);
        // Ensure we have at least 2 fields for next time
        while (filtered.length < 2) {
          filtered.push({
            id: `user-${filtered.length}`,
            username: '',
            validation: { isValidating: false, isValid: null, profile: null, error: null, lastValidatedValue: null },
          });
        }
        return filtered;
      });
      
      validUsers.forEach(u => saveUsername(u.username.trim()));
      setSuggestions(getStoredUsernames());
      onSubmit(validUsers.map(u => u.username.trim()));
    }
  };

  const allValid = userInputs.every(u => !u.username.trim() || u.validation.isValid === true);
  const hasAtLeastTwoValid = userInputs.filter(u => u.validation.isValid === true).length >= 2;

  return (
    <form className="watchlist-form" onSubmit={handleSubmit}>
      {userInputs.map((input, index) => {
        const colorIndex = index % 3;
        const circleColor = colorIndex === 0 ? '#FF8000' : colorIndex === 1 ? '#00E054' : '#40BCF4';
        return (
        <div 
          key={input.id} 
          className={`form-group ${activeDropdown === input.id ? 'has-active-dropdown' : ''}`}
          style={{ '--circle-color': circleColor } as React.CSSProperties}
        >
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
                {input.validation.isValid === true && !input.validation.isValidating && (
                  <span className="label-icon valid-icon">
                    <FaCheck />
                  </span>
                )}
              </span>
            ) : (
              <>
                {`${getOrdinalName(index)} Username`}
                {input.validation.isValid === true && !input.validation.isValidating && (
                  <span className="label-icon valid-icon">
                    <FaCheck />
                  </span>
                )}
              </>
            )}
          </label>
          <div className="input-wrapper">
            <input
              id={input.id}
              type="text"
              value={input.username}
              onChange={(e) => handleUsernameChange(e.target.value, input.id)}
              onFocus={() => {
                // Close Find Friends dropdown when username input is focused
                setOpenFollowingDropdown(null);
                const filtered = getFilteredSuggestions(input.username, input.id);
                if (filtered.length > 0) {
                  setActiveDropdown(input.id);
                }
              }}
              onBlur={() => {
                // Delay to allow click on suggestion
                setTimeout(() => {
                  handleBlur(input.id);
                  setActiveDropdown(null);
                  setSelectedSuggestionIndex(-1);
                }, 200);
              }}
              onKeyDown={(e) => handleKeyDown(e, input.id)}
              placeholder="Enter Letterboxd username"
              disabled={isLoading}
              required
              autoComplete="off"
              className={input.validation.isValid === true ? 'valid' : input.validation.isValid === false ? 'invalid' : ''}
            />
            {/* Custom dropdown arrow - only show if there are matching suggestions and no validation icons */}
            {getFilteredSuggestions(input.username, input.id).length > 0 && 
             !input.validation.isValidating && 
             input.validation.isValid === null && (
              <span className="dropdown-arrow-icon">▼</span>
            )}
            {/* Custom suggestions dropdown */}
            {activeDropdown === input.id && getFilteredSuggestions(input.username, input.id).length > 0 && (
              <div 
                className="suggestions-dropdown"
                ref={(el) => {
                  if (el) {
                    dropdownRefs.current.set(input.id, el);
                  } else {
                    dropdownRefs.current.delete(input.id);
                  }
                }}
              >
                <ul>
                  {getFilteredSuggestions(input.username, input.id).map((suggestion, index) => (
                    <li
                      key={suggestion}
                      className={index === selectedSuggestionIndex ? 'selected' : ''}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent blur
                        handleUsernameChange(suggestion, input.id);
                        setActiveDropdown(null);
                        setSelectedSuggestionIndex(-1);
                      }}
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {input.validation.isValidating && (
              <span className="input-icon validating">
                <span className="spinner"></span>
              </span>
            )}
          </div>
          <button
            type="button"
            className="remove-user-button"
            onClick={() => removeUser(input.id)}
            disabled={isLoading || userInputs.length <= 2}
            aria-label="Remove user"
            style={{ backgroundColor: circleColor }}
          >
            {userInputs.length > 2 && <FaTimes className="remove-x-icon" />}
          </button>
          {input.validation.error && (
            <div className="error-message" role="alert">
              {input.validation.error}
            </div>
          )}
          {input.validation.isValid === true && input.validation.profile && followingFeatureEnabled === true && (
            <FollowingDropdown
              username={input.username}
              profile={input.validation.profile}
              onSelectUser={(user) => handleSelectFollowingUser(user, input.id)}
              disabled={isLoading}
              userId={input.id}
              isOpen={openFollowingDropdown === input.id}
              onToggle={(isOpen) => {
                if (isOpen) {
                  setOpenFollowingDropdown(input.id);
                  // Close username autocomplete dropdowns when Find Friends opens
                  setActiveDropdown(null);
                  setSelectedSuggestionIndex(-1);
                } else {
                  setOpenFollowingDropdown(null);
                }
              }}
            />
          )}
        </div>
        );
      })}
      
      {userInputs.length < MAX_USERS && (
        <div 
          className="add-user-button-wrapper"
        >
          <button
            type="button"
            className="add-user-button"
            onClick={addUser}
            disabled={isLoading}
          >
            <FaPlus />
            <span>Add User</span>
          </button>
        </div>
      )}
      
      
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
