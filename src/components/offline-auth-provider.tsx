"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { persistentAuth, AuthSession, User } from '@/lib/auth/persistent-auth';
import { syncManager } from '@/lib/sync/sync-manager';
import { initializeQueryPersistence, prefetchCriticalData } from '@/lib/query-client';
import { getCurrentUser } from '@/lib/auth-client';

interface AuthContextType {
  session: AuthSession | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface OfflineAuthProviderProps {
  children: ReactNode;
}

export function OfflineAuthProvider({ children }: OfflineAuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize authentication and offline systems
  useEffect(() => {
    async function initialize() {
      try {
        console.log('Initializing offline auth system...');
        
        // Initialize query persistence first
        await initializeQueryPersistence();
        
        // Check for existing cookie-based session first
        let currentUser: User | null = null;
        try {
          currentUser = await getCurrentUser();
        } catch (error) {
          console.log('No existing cookie session found');
        }
        
        if (currentUser) {
          // User has valid cookie session, create offline session
          console.log('Found existing cookie session for user:', currentUser.username);
          const cookieSession: AuthSession = {
            user: {
              ...currentUser,
              createdAt: new Date(currentUser.createdAt),
              updatedAt: new Date(currentUser.updatedAt)
            },
            token: 'cookie-based-auth',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          };
          
          // Save to offline storage and set state
          await persistentAuth.saveSession(cookieSession);
          setSession(cookieSession);
          
          // Prefetch critical data
          await prefetchCriticalData(currentUser.id);
        } else {
          // No cookie session, check offline storage
          const storedSession = await persistentAuth.initialize();
          if (storedSession) {
            console.log('Found stored session for user:', storedSession.user.username);
            setSession(storedSession);
            
            // Validate with server if online
            if (navigator.onLine) {
              try {
                const isValid = await persistentAuth.validateSessionOnline();
                if (!isValid) {
                  console.log('Stored session invalid, clearing');
                  setSession(null);
                  await persistentAuth.logout();
                }
              } catch (error) {
                console.log('Session validation failed, but keeping offline session');
              }
            }
          }
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize auth system:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    initialize();
  }, []);

  // Validate session when online (disabled to prevent API call loops)
  useEffect(() => {
    if (!isInitialized || !session) return;

    // Listen for online events but don't auto-validate
    const handleOnline = () => {
      console.log('Back online - session will be validated on next user action');
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [session, isInitialized]);

  const handleLogin = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await persistentAuth.login(username, password);
      
      if (result.success && result.session) {
        setSession(result.session);
        
        // Prefetch critical data after successful login
        await prefetchCriticalData(result.session.user.id);
        
        return { success: true };
      } else {
        return { 
          success: false, 
          error: result.error || 'Login failed' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await persistentAuth.logout();
      setSession(null);
      
      // Clear all cached data on logout
      const { clearQueryCache } = await import('@/lib/query-client');
      await clearQueryCache();
      
      // Redirect to login
      window.location.href = '/login';
      
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshSession = async () => {
    if (!session) return;
    
    try {
      const refreshedSession = await persistentAuth.refreshSession();
      if (refreshedSession) {
        setSession(refreshedSession);
      } else {
        // Refresh failed, logout
        await handleLogout();
      }
    } catch (error) {
      console.error('Session refresh error:', error);
    }
  };

  const contextValue: AuthContextType = {
    session,
    user: session?.user || null,
    isLoading,
    isAuthenticated: !!session,
    login: handleLogin,
    logout: handleLogout,
    refreshSession: handleRefreshSession,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useOfflineAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useOfflineAuth must be used within an OfflineAuthProvider');
  }
  return context;
}

// Compatibility hook for existing code
export function useSession() {
  const { session, isLoading } = useOfflineAuth();
  
  return {
    data: session ? { user: session.user } : null,
    isPending: isLoading,
  };
}