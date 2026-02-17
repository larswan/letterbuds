import { useState, useEffect, useRef } from 'react';
import '../styles/components/_spinner.scss';

interface LoadingSpinnerProps {
  currentUsername?: string;
}

export function LoadingSpinner({ currentUsername }: LoadingSpinnerProps) {
  const [displayMessage, setDisplayMessage] = useState<string>('');
  const [isVisible, setIsVisible] = useState(true);
  const lastUsernameRef = useRef<string | undefined>(undefined);
  const messageCycleIndexRef = useRef<number>(0);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Info messages to cycle through
  const infoMessages = [
    'Longer lists take more time to scrape',
    'Letterboxd just doesn\'t want to make an API',
    'Thank you to screeny05 for the scraper'
  ];

  useEffect(() => {
    // Clear any existing timer
    if (cycleTimerRef.current) {
      clearTimeout(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }

    if (currentUsername) {
      const usernameMessage = `Scraping ${currentUsername}'s watchlist`;
      
      // If username changed, reset cycle and show username message
      if (currentUsername !== lastUsernameRef.current) {
        messageCycleIndexRef.current = 0;
        lastUsernameRef.current = currentUsername;
        
        // Show username message immediately
        setDisplayMessage(usernameMessage);
        setIsVisible(true);
        
        // Start the cycle
        const cycleMessages = () => {
          // Wait 5 seconds before showing first info message (username shows for 5s)
          cycleTimerRef.current = setTimeout(() => {
            if (currentUsername !== lastUsernameRef.current) {
              return; // Username changed, stop cycling
            }
            
            // Fade out username message
            setIsVisible(false);
            
            setTimeout(() => {
              // Show info message
              const infoMessage = infoMessages[messageCycleIndexRef.current];
              setDisplayMessage(infoMessage);
              setIsVisible(true);
              
              // After 3 seconds, show username again
              cycleTimerRef.current = setTimeout(() => {
                if (currentUsername !== lastUsernameRef.current) {
                  return;
                }
                
                setIsVisible(false);
                
                setTimeout(() => {
                  setDisplayMessage(usernameMessage);
                  setIsVisible(true);
                  
                  // Move to next info message
                  messageCycleIndexRef.current = (messageCycleIndexRef.current + 1) % infoMessages.length;
                  
                  // Continue cycling (username shows for 5s, then next info for 3s)
                  cycleMessages();
                }, 300);
              }, 3000); // Info message shows for 3 seconds
            }, 300);
          }, 5000); // Username message shows for 5 seconds
        };
        
        // Start cycling after 5 seconds (first username message shows for 5s)
        cycleMessages();
      }
    } else {
      // No username - clear message
      setDisplayMessage('');
      setIsVisible(false);
      lastUsernameRef.current = undefined;
      messageCycleIndexRef.current = 0;
    }

    return () => {
      if (cycleTimerRef.current) {
        clearTimeout(cycleTimerRef.current);
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

