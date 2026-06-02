import { OfflineStore } from '../db/offline-db';

export interface User {
  id: string;
  username: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
}

export class PersistentAuth {
  private static instance: PersistentAuth;
  private currentSession: AuthSession | null = null;
  private sessionPromise: Promise<AuthSession | null> | null = null;

  static getInstance(): PersistentAuth {
    if (!PersistentAuth.instance) {
      PersistentAuth.instance = new PersistentAuth();
    }
    return PersistentAuth.instance;
  }

  /**
   * Initialize auth by loading session from IndexedDB
   */
  async initialize(): Promise<AuthSession | null> {
    if (this.sessionPromise) {
      return this.sessionPromise;
    }

    this.sessionPromise = this._loadSession();
    const session = await this.sessionPromise;
    this.sessionPromise = null;
    return session;
  }

  private async _loadSession(): Promise<AuthSession | null> {
    try {
      const storedSession = await OfflineStore.getSession();
      if (storedSession) {
        this.currentSession = {
          user: {
            ...storedSession.user,
            createdAt: new Date(storedSession.user.createdAt),
            updatedAt: new Date(storedSession.user.updatedAt)
          },
          token: storedSession.token,
          expiresAt: storedSession.expiresAt
        };
        return this.currentSession;
      }
    } catch (error) {
      console.error('Failed to load session from IndexedDB:', error);
    }
    
    this.currentSession = null;
    return null;
  }

  /**
   * Authenticate user online and store session offline
   */
  async login(username: string, password: string): Promise<{
    success: boolean;
    session?: AuthSession;
    error?: string;
  }> {
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Authentication failed' };
      }

      const data = await response.json();
      
      // Extract token from cookie (since it's HTTP-only, we need to handle this differently)
      // For now, we'll create a session based on the user data
      const session: AuthSession = {
        user: {
          ...data.user,
          createdAt: new Date(data.user.createdAt),
          updatedAt: new Date(data.user.updatedAt)
        },
        token: 'cookie-based-auth', // Placeholder since we use HTTP-only cookies
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };

      // Store session offline
      await this.saveSession(session);
      
      return { success: true, session };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error - please try again' 
      };
    }
  }

  /**
   * Save session both in memory and offline storage
   */
  async saveSession(session: AuthSession): Promise<void> {
    this.currentSession = session;
    
    try {
      await OfflineStore.saveSession({
        user: {
          ...session.user,
          createdAt: session.user.createdAt.toISOString(),
          updatedAt: session.user.updatedAt.toISOString()
        },
        token: session.token,
        expiresAt: session.expiresAt,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to save session offline:', error);
    }
  }

  /**
   * Get current session (from memory or storage)
   */
  async getSession(): Promise<AuthSession | null> {
    if (this.currentSession) {
      // Check if current session is still valid
      if (new Date(this.currentSession.expiresAt) > new Date()) {
        return this.currentSession;
      } else {
        // Session expired, clear it
        await this.logout();
        return null;
      }
    }

    // Try to load from storage
    return await this.initialize();
  }

  /**
   * Check if user is authenticated (works offline)
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    const session = await this.getSession();
    return session?.user || null;
  }

  /**
   * Logout and clear all session data
   */
  async logout(): Promise<void> {
    this.currentSession = null;
    
    try {
      await OfflineStore.clearSession();
    } catch (error) {
      console.error('Failed to clear session from storage:', error);
    }

    // Try to logout from server (don't fail if offline)
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      // Ignore network errors during logout
      console.log('Logout from server failed (offline?):', error);
    }
  }

  /**
   * Refresh session token (online only)
   */
  async refreshSession(): Promise<AuthSession | null> {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Token might be invalid, logout
        await this.logout();
        return null;
      }

      const data = await response.json();
      const newSession: AuthSession = {
        user: {
          ...data.user,
          createdAt: new Date(data.user.createdAt),
          updatedAt: new Date(data.user.updatedAt)
        },
        token: 'cookie-based-auth', // Placeholder for HTTP-only cookie
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Reset expiration
      };

      await this.saveSession(newSession);
      return newSession;
    } catch (error) {
      // Network error, keep current session if still valid
      console.log('Session refresh failed (offline?):', error);
      const currentSession = await this.getSession();
      return currentSession;
    }
  }

  /**
   * Validate session with server when online
   */
  async validateSessionOnline(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
      });

      if (!response.ok) {
        await this.logout();
        return false;
      }

      // Update session with latest user data
      const data = await response.json();
      const session: AuthSession = {
        user: {
          ...data.user,
          createdAt: new Date(data.user.createdAt),
          updatedAt: new Date(data.user.updatedAt)
        },
        token: 'cookie-based-auth',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      await this.saveSession(session);
      
      return true;
    } catch (error) {
      // Network error, assume session is valid if not expired
      console.log('Session validation failed (offline?):', error);
      const session = await this.getSession();
      return session ? new Date(session.expiresAt) > new Date() : false;
    }
  }

  /**
   * Get authorization header for API requests
   * Note: Since we use HTTP-only cookies, we don't need to manually set headers
   */
  async getAuthHeader(): Promise<Record<string, never>> {
    // HTTP-only cookies are automatically included in requests
    // No need to manually set authorization headers
    return {};
  }
}

// Singleton instance
export const persistentAuth = PersistentAuth.getInstance();