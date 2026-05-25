import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
    { expiresIn: '7d' }
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
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() }
    });

    if (existingUser) {
      return { success: false, error: 'Username already exists' };
    }

    // Validate input
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long' };
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase().trim(),
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
    // Find user
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() }
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