/**
 * Edge-compatible authentication utilities for middleware
 * Uses Web Crypto API instead of Node.js crypto module
 */

// Simple JWT verification for edge runtime (basic validation only)
export function verifyTokenEdge(token: string): { userId: string; username: string; role: string } | null {
  try {
    // For edge runtime, we'll do basic token validation
    // The actual JWT verification will happen in API routes
    if (!token || token.length < 10) {
      return null;
    }

    // Basic JWT structure check
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (without verification for edge compatibility)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check if token is expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    // Return basic user info if token structure is valid
    if (payload.userId && payload.username && payload.role) {
      return {
        userId: payload.userId,
        username: payload.username,
        role: payload.role
      };
    }

    return null;
  } catch {
    return null;
  }
}

// Extract token from cookie header
export function extractTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  try {
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(cookie => {
        const [name, value] = cookie.split('=');
        return [name, decodeURIComponent(value)];
      })
    );

    return cookies['auth-token'] || null;
  } catch {
    return null;
  }
}