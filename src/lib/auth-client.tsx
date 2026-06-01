import { User } from './auth';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export interface SessionData {
  user: User;
}

export interface UseSessionReturn {
  data: SessionData | null;
  isPending: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Auth Context
const AuthContext = createContext<UseSessionReturn>({
  data: null,
  isPending: true,
  error: null,
  refresh: async () => {},
});

// Auth Provider Component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SessionData | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = async () => {
    try {
      setIsPending(true);
      setError(null);
      
      const user = await getCurrentUser();
      
      if (user) {
        setData({ user });
      } else {
        setData(null);
      }
    } catch (err) {
      setError('Failed to load session');
      setData(null);
    } finally {
      setIsPending(false);
    }
  };

  useEffect(() => {
    // Use a callback to avoid direct setState in effect
    const initializeSession = () => {
      loadSession();
    };
    initializeSession();
  }, []);

  // Expose refresh function for manual session updates
  const contextValue = {
    data,
    isPending,
    error,
    refresh: loadSession
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// useSession Hook
export function useSession(): UseSessionReturn {
  return useContext(AuthContext);
}

export async function signUp(username: string, password: string): Promise<AuthResponse> {
  try {
    // Client-side validation
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    if (username.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters long' };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { success: false, error: 'Username can only contain letters, numbers, and underscores' };
    }

    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long' };
    }

    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.toLowerCase().trim(), password })
    });

    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return { success: false, error: 'Server returned invalid response format' };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Signup failed' };
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, error: 'Network error. Please check your connection and try again.' };
  }
}

export async function signIn(username: string, password: string): Promise<AuthResponse> {
  try {
    // Client-side validation
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.toLowerCase().trim(), password })
    });

    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return { success: false, error: 'Server returned invalid response format' };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Sign in failed' };
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Signin error:', error);
    return { success: false, error: 'Network error. Please check your connection and try again.' };
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/signout', { method: 'POST' });
    // Reload the page to clear the session
    window.location.href = '/login';
  } catch (error) {
    console.error('Signout error:', error);
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch('/api/auth/me');
    
    if (!response.ok) {
      return null;
    }

    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('getCurrentUser: Server returned non-JSON response');
      return null;
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}