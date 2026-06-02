import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
export const AUTH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;

export interface User {
  id: string;
  username: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(user: User): string {
  return jwt.sign(
    { 
      userId: user.id, 
      username: user.username, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
}

export function verifyToken(token: string): { userId: string; username: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };
  } catch {
    return null;
  }
}

export async function signUp(username: string, password: string): Promise<AuthResult> {
  try {
    // Validate input
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    const trimmedUsername = username.toLowerCase().trim();

    // Enhanced validation
    if (trimmedUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters long' };
    }

    if (trimmedUsername.length > 30) {
      return { success: false, error: 'Username must be less than 30 characters' };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      return { success: false, error: 'Username can only contain letters, numbers, and underscores' };
    }

    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long' };
    }

    if (password.length > 128) {
      return { success: false, error: 'Password must be less than 128 characters' };
    }

    // Check password complexity
    if (!/[a-zA-Z]/.test(password)) {
      return { success: false, error: 'Password must contain at least one letter' };
    }

    if (!/\d/.test(password)) {
      return { success: false, error: 'Password must contain at least one number' };
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: trimmedUsername }
    });

    if (existingUser) {
      return { success: false, error: 'Username already exists' };
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        password: hashedPassword,
        role: 'user' // Default role for new users
      }
    });

    const token = generateToken(user);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      token
    };
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, error: 'Failed to create user' };
  }
}

export async function signIn(username: string, password: string): Promise<AuthResult> {
  try {
    // Validate input
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    const trimmedUsername = username.toLowerCase().trim();

    // Find user
    const user = await prisma.user.findUnique({
      where: { username: trimmedUsername }
    });

    if (!user) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return { success: false, error: 'Invalid username or password' };
    }

    const token = generateToken(user);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      token
    };
  } catch (error) {
    console.error('Signin error:', error);
    return { success: false, error: 'Failed to sign in' };
  }
}

export async function getUserFromToken(token: string): Promise<User | null> {
  try {
    const decoded = verifyToken(token);
    if (!decoded) return null;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  } catch {
    return null;
  }
}

// Helper function for API routes to get current user from request
export async function auth(request: Request): Promise<User | null> {
  try {
    // Get token from cookies
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(cookie => {
        const [name, value] = cookie.split('=');
        return [name, decodeURIComponent(value)];
      })
    );

    const token = cookies['auth-token'];
    if (!token) return null;

    return await getUserFromToken(token);
  } catch {
    return null;
  }
}

// Auth object with API methods for compatibility with existing API routes
export const authAPI = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      try {
        const cookieHeader = headers.get('cookie');
        if (!cookieHeader) return null;

        const cookies = Object.fromEntries(
          cookieHeader.split('; ').map(cookie => {
            const [name, value] = cookie.split('=');
            return [name, decodeURIComponent(value)];
          })
        );

        const token = cookies['auth-token'];
        if (!token) return null;

        const user = await getUserFromToken(token);
        if (!user) return null;

        return { user };
      } catch {
        return null;
      }
    }
  }
};