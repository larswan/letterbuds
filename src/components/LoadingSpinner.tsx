import { useState, useEffect, useRef } from 'react';
import '../styles/components/_spinner.scss';

interface LoadingSpinnerProps {
  currentUsername?: string;
}

export function LoadingSpinner({ currentUsername }: LoadingSpinnerProps) {
  const [displayMessage, setDisplayMessage] = useState<string>('');
  const [isVisible, setIsVisible] = useState(true);
  const lastUsernameRef = useRef<string | undefined>(undefined);
  const messageStartTimeRef = useRef<number>(0);
  const timeoutMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showingTimeoutMessageRef = useRef<boolean>(false);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutMessageTimerRef.current) {
      clearTimeout(timeoutMessageTimerRef.current);
      timeoutMessageTimerRef.current = null;
    }

    if (currentUsername) {
      const newMessage = `Scraping ${currentUsername}'s watchlist`;
      
      // If username changed, fade out old message, then fade in new
      if (currentUsername !== lastUsernameRef.current) {
        showingTimeoutMessageRef.current = false;
        
        // Helper function to set up timeout timer
        const setupTimeoutTimer = () => {
          timeoutMessageTimerRef.current = setTimeout(() => {
            if (currentUsername === lastUsernameRef.current && !showingTimeoutMessageRef.current) {
              showingTimeoutMessageRef.current = true;
              setIsVisible(false);
              setTimeout(() => {
                setDisplayMessage('Larger watchlists will take longer to scrape');
                setIsVisible(true);
                setTimeout(() => {
                  setIsVisible(false);
                  setTimeout(() => {
                    setDisplayMessage(newMessage);
                    setIsVisible(true);
                    showingTimeoutMessageRef.current = false;
                    messageStartTimeRef.current = Date.now();
                  }, 300);
                }, 3000);
              }, 300);
            }
          }, 3000);
        };
        
        // If we have a previous message, fade it out first
        if (lastUsernameRef.current !== undefined) {
          setIsVisible(false);
          setTimeout(() => {
            setDisplayMessage(newMessage);
            setIsVisible(true);
            lastUsernameRef.current = currentUsername;
            messageStartTimeRef.current = Date.now();
            setupTimeoutTimer();
          }, 300); // Standard fade transition timing (300ms)
        } else {
          // First message - show immediately
          setDisplayMessage(newMessage);
          setIsVisible(true);
          lastUsernameRef.current = currentUsername;
          messageStartTimeRef.current = Date.now();
          setupTimeoutTimer();
        }
      }
    } else {
      // No username - clear message
      setDisplayMessage('');
      setIsVisible(false);
      showingTimeoutMessageRef.current = false;
      lastUsernameRef.current = undefined;
    }

    return () => {
      if (timeoutMessageTimerRef.current) {
        clearTimeout(timeoutMessageTimerRef.current);
      }
    };
  }, [currentUsername]);

  // Don't render if no message
  if (!displayMessage) {
    return null;
  }

  return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p className={isVisible ? 'visible' : 'hidden'}>{displayMessage}</p>
    </div>
  );
}

