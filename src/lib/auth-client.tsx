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
}

// Auth Context
const AuthContext = createContext<UseSessionReturn>({
  data: null,
  isPending: true,
  error: null,
});

// Auth Provider Component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SessionData | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
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
    }

    loadSession();
  }, []);

  return (
    <AuthContext.Provider value={{ data, isPending, error }}>
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
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Signup failed' };
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, error: 'Network error' };
  }
}

export async function signIn(username: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Signin failed' };
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Signin error:', error);
    return { success: false, error: 'Network error' };
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

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}