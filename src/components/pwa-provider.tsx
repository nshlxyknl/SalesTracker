'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAProviderProps {
  children: React.ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if app is already installed
    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInWebAppiOS = (window.navigator as any).standalone === true;
      const isInstalled = isStandalone || isInWebAppiOS;
      
      setIsInstalled(isInstalled);
      
      // Add standalone app behavior
      if (isInstalled) {
        // Prevent zoom on double tap for better app-like experience
        document.addEventListener('touchstart', function(event) {
          if (event.touches.length > 1) {
            event.preventDefault();
          }
        });
        
        // Add app-like navigation behavior
        document.body.classList.add('pwa-installed');
        
        // Handle back button behavior in standalone mode
        if (window.history.length === 1) {
          window.history.pushState({}, '', window.location.href);
        }
      }
    };

    checkIfInstalled();

    // Register service worker with enhanced error handling
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none' // Always check for updates
          });
          
          setSwRegistration(registration);
          console.log('Service Worker registered successfully:', registration);

          // Handle service worker updates with user notification
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker is available - show update notification
                  console.log('New service worker available');
                  showUpdateNotification();
                }
              });
            }
          });

          // Listen for messages from service worker
          navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('Message from service worker:', event.data);
            
            if (event.data.type === 'SYNC_COMPLETE') {
              console.log('Offline data sync completed');
              showSyncNotification('Data synced successfully', 'success');
            }
            
            if (event.data.type === 'SYNC_FAILED') {
              console.error('Offline data sync failed:', event.data.error);
              showSyncNotification('Sync failed - will retry later', 'error');
            }
            
            if (event.data.type === 'CACHE_UPDATED') {
              console.log('Cache updated with new content');
            }
          });

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute

        } catch (error) {
          console.error('Service Worker registration failed:', error);
          // Graceful degradation - app still works without SW
        }
      }
    };

    registerServiceWorker();

    // Handle PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const beforeInstallPromptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(beforeInstallPromptEvent);
      setIsInstallable(true);
      console.log('PWA install prompt available');
    };

    // Handle app installed event
    const handleAppInstalled = () => {
      console.log('PWA was installed');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Function to show update notification
  const showUpdateNotification = () => {
    // Create a custom notification for app updates
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Sales Tracker Update Available', {
        body: 'A new version is available. Refresh to update.',
        icon: '/icons/icon-192x192.svg',
        tag: 'app-update'
      });
    }
  };

  // Function to show sync notifications
  const showSyncNotification = (message: string, type: 'success' | 'error') => {
    // You can integrate this with your notification system
    console.log(`[PWA] ${type.toUpperCase()}: ${message}`);
  };

  // Function to trigger PWA installation with enhanced UX
  const installPWA = async () => {
    if (deferredPrompt) {
      try {
        // Hide the install banner immediately
        setIsInstallable(false);
        
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
          // Track installation success
          if ('gtag' in window) {
            (window as any).gtag('event', 'pwa_install', {
              event_category: 'engagement',
              event_label: 'accepted'
            });
          }
        } else {
          console.log('User dismissed the PWA install prompt');
          // Show install banner again after delay if dismissed
          setTimeout(() => {
            setIsInstallable(true);
          }, 300000); // Show again after 5 minutes
        }
        
        setDeferredPrompt(null);
      } catch (error) {
        console.error('Error during PWA installation:', error);
        setIsInstallable(true); // Show banner again on error
      }
    }
  };

  // Function to check for service worker updates
  const checkForUpdates = async () => {
    if (swRegistration) {
      try {
        await swRegistration.update();
        console.log('Checked for service worker updates');
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    }
  };

  // Provide PWA context to children
  const pwaContext = {
    isInstallable,
    isInstalled,
    installPWA,
    checkForUpdates,
    swRegistration,
    showUpdateNotification,
    showSyncNotification,
  };

  // Add PWA context to window for global access
  useEffect(() => {
    (window as any).pwaContext = pwaContext;
  }, [pwaContext]);

  return (
    <>
      {children}
      {/* Enhanced PWA Install Banner */}
      {isInstallable && !isInstalled && (
        <div className="fixed bottom-4 left-4 right-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl shadow-2xl z-50 md:left-auto md:right-4 md:max-w-sm border border-blue-500/20">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm leading-tight">Install Sales Tracker</h3>
                <p className="text-xs opacity-90 mt-1 leading-relaxed">
                  Get faster access, offline support, and a native app experience
                </p>
                <div className="flex items-center gap-1 mt-2 text-xs opacity-75">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Works offline</span>
                  <span className="mx-1">•</span>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Fast loading</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsInstallable(false)}
              className="text-white/60 hover:text-white/80 p-1 -mt-1 -mr-1 flex-shrink-0"
              aria-label="Dismiss install prompt"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setIsInstallable(false)}
              className="text-xs px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition-colors flex-1"
            >
              Maybe Later
            </button>
            <button
              onClick={installPWA}
              className="text-xs px-3 py-2 rounded-lg bg-white text-blue-600 hover:bg-blue-50 font-medium transition-colors flex-1"
            >
              Install App
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Hook to use PWA functionality
export function usePWA() {
  return (window as any).pwaContext || {
    isInstallable: false,
    isInstalled: false,
    installPWA: () => {},
    checkForUpdates: () => {},
    swRegistration: null,
  };
}