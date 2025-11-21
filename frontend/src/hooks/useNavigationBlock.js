import { useEffect, useRef } from 'react';

/**
 * Custom hook to disable browser back/forward navigation
 * Prevents users from navigating away from dashboards using browser navigation buttons
 */
export const useNavigationBlock = () => {
    const navigationBlockedShownRef = useRef(false);

    useEffect(() => {
        // Push initial state to history stack
        window.history.pushState(null, null, window.location.pathname);

        // Handler to block back/forward navigation
        const handlePopstate = () => {
            // Re-push state to stay on current page
            window.history.pushState(null, null, window.location.pathname);

            // Show warning only once
            if (!navigationBlockedShownRef.current) {
                navigationBlockedShownRef.current = true;
                console.warn('Navigation blocked: Use logout button to exit dashboard');
                // Auto-reset flag after 3 seconds to allow multiple warnings if needed
                setTimeout(() => {
                    navigationBlockedShownRef.current = false;
                }, 3000);
            }
        };

        // Add popstate listener
        window.addEventListener('popstate', handlePopstate);

        // Cleanup
        return () => {
            window.removeEventListener('popstate', handlePopstate);
        };
    }, []);
};
