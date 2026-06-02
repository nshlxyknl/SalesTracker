"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { persistentAuth, AuthSession, User } from '@/lib/auth/persistent-auth';
import { syncManager } from '@/lib/sync/sync-manager';
import { initializeQueryPersistence, prefetchCriticalData } from '@/lib/query-client';

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
        
        // Load stored session
        const storedSession = await persistentAuth.initialize();
        setSession(storedSession);
        
        // If we have a session, prefetch critical data
        if (storedSession) {
          console.log('Found stored session for user:', storedSession.user.username);
          await prefetchCriticalData(storedSession.user.id);
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

  // Validate session when online
  useEffect(() => {
    if (!isInitialized || !session) return;

    const validateSession = async () => {
      if (navigator.onLine) {
        try {
          const isValid = await persistentAuth.validateSessionOnline();
          if (!isValid) {
            console.log('Session invalid, logging out');
            await handleLogout();
          }
        } catch (error) {
          console.log('Session validation failed (offline?):', error);
        }
      }
    };

    // Validate immediately if online
    if (navigator.onLine) {
      validateSession();
    }

    // Listen for online events to validate session
    const handleOnline = () => {
      validateSession();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
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