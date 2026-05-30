import { NextRequest } from 'next/server';
import { getUserFromToken, User } from './auth';
import { hasPermission, Permission, UserRole } from './rbac';

export interface AuthenticatedRequest extends NextRequest {
  user: User;
}

export interface ApiAuthResult {
  success: boolean;
  user?: User;
  error?: string;
  status?: number;
}

/**
 * Authenticate user from request headers or cookies
 */
export async function authenticateRequest(request: NextRequest): Promise<ApiAuthResult> {
  try {
    // Try to get user from middleware headers first (more efficient)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    const username = request.headers.get('x-username');

    if (userId && userRole && username) {
      // User info was already validated by middleware
      const user: User = {
        id: userId,
        username: username,
        role: userRole,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return { success: true, user };
    }

    // Fallback to cookie-based authentication
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return { 
        success: false, 
        error: 'Authentication required', 
        status: 401 
      };
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return { 
        success: false, 
        error: 'Invalid authentication token', 
        status: 401 
      };
    }

    return { success: true, user };
  } catch (error) {
    console.error('Authentication error:', error);
    return { 
      success: false, 
      error: 'Authentication failed', 
      status: 500 
    };
  }
}

/**
 * Require authentication for API route
 */
export async function requireAuth(request: NextRequest): Promise<{ user: User } | Response> {
  const authResult = await authenticateRequest(request);
  
  if (!authResult.success) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { 
        status: authResult.status || 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  return { user: authResult.user! };
}

/**
 * Enhanced role validation with detailed error messages
 */
export async function requireRole(
  request: NextRequest, 
  requiredRole: UserRole
): Promise<{ user: User } | Response> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof Response) {
    return authResult; // Authentication failed
  }

  const { user } = authResult;
  
  if (user.role !== requiredRole) {
    const errorMessage = requiredRole === 'admin' 
      ? 'Admin access required. This endpoint is restricted to administrators only.'
      : 'User access required. This endpoint is restricted to regular users only.';
      
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        requiredRole,
        userRole: user.role
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  return { user };
}

/**
 * Require admin role specifically
 */
export async function requireAdmin(request: NextRequest): Promise<{ user: User } | Response> {
  return requireRole(request, 'admin');
}

/**
 * Require user role specifically  
 */
export async function requireUser(request: NextRequest): Promise<{ user: User } | Response> {
  return requireRole(request, 'user');
}

/**
 * Allow both admin and user roles
 */
export async function requireUserOrAdmin(request: NextRequest): Promise<{ user: User } | Response> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof Response) {
    return authResult; // Authentication failed
  }

  const { user } = authResult;
  
  if (user.role !== 'admin' && user.role !== 'user') {
    return new Response(
      JSON.stringify({ 
        error: 'Invalid user role. Access denied.',
        userRole: user.role
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  return { user };
}

/**
 * Require specific permission for API route
 */
export async function requirePermission(
  request: NextRequest, 
  requiredPermission: Permission
): Promise<{ user: User } | Response> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof Response) {
    return authResult; // Authentication failed
  }

  const { user } = authResult;
  
  if (!hasPermission(user, requiredPermission)) {
    return new Response(
      JSON.stringify({ 
        error: `Access denied. Required permission: ${requiredPermission}` 
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  return { user };
}

/**
 * Require any of the specified permissions for API route
 */
export async function requireAnyPermission(
  request: NextRequest, 
  requiredPermissions: Permission[]
): Promise<{ user: User } | Response> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof Response) {
    return authResult; // Authentication failed
  }

  const { user } = authResult;
  
  const hasAnyPermission = requiredPermissions.some(permission => 
    hasPermission(user, permission)
  );
  
  if (!hasAnyPermission) {
    return new Response(
      JSON.stringify({ 
        error: `Access denied. Required permissions: ${requiredPermissions.join(', ')}` 
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  return { user };
}

/**
 * Check if user owns the resource (for user-specific data access)
 */
export function checkResourceOwnership(user: User, resourceUserId: string): boolean {
  // Admins can access all resources
  if (user.role === 'admin') {
    return true;
  }
  
  // Users can only access their own resources
  return user.id === resourceUserId;
}

/**
 * Require resource ownership or admin role
 */
export async function requireOwnershipOrAdmin(
  request: NextRequest,
  resourceUserId: string
): Promise<{ user: User } | Response> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof Response) {
    return authResult; // Authentication failed
  }

  const { user } = authResult;
  
  if (!checkResourceOwnership(user, resourceUserId)) {
    return new Response(
      JSON.stringify({ 
        error: 'Access denied. You can only access your own resources.' 
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  return { user };
}

/**
 * Higher-order function to wrap API handlers with authentication
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, user: User, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof Response) {
      return authResult;
    }

    return handler(request, authResult.user, ...args);
  };
}

/**
 * Higher-order function to wrap API handlers with role requirement
 */
export function withRole<T extends any[]>(
  requiredRole: UserRole,
  handler: (request: NextRequest, user: User, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const authResult = await requireRole(request, requiredRole);
    
    if (authResult instanceof Response) {
      return authResult;
    }

    return handler(request, authResult.user, ...args);
  };
}

/**
 * Higher-order function to wrap API handlers with permission requirement
 */
export function withPermission<T extends any[]>(
  requiredPermission: Permission,
  handler: (request: NextRequest, user: User, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const authResult = await requirePermission(request, requiredPermission);
    
    if (authResult instanceof Response) {
      return authResult;
    }

    return handler(request, authResult.user, ...args);
  };
}

/**
 * Higher-order function to wrap API handlers with admin role requirement
 */
export function withAdmin<T extends any[]>(
  handler: (request: NextRequest, user: User, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const authResult = await requireAdmin(request);
    
    if (authResult instanceof Response) {
      return authResult;
    }

    return handler(request, authResult.user, ...args);
  };
}

/**
 * Higher-order function to wrap API handlers with user role requirement
 */
export function withUser<T extends any[]>(
  handler: (request: NextRequest, user: User, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const authResult = await requireUser(request);
    
    if (authResult instanceof Response) {
      return authResult;
    }

    return handler(request, authResult.user, ...args);
  };
}

/**
 * Higher-order function to wrap API handlers allowing both user and admin roles
 */
export function withUserOrAdmin<T extends any[]>(
  handler: (request: NextRequest, user: User, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const authResult = await requireUserOrAdmin(request);
    
    if (authResult instanceof Response) {
      return authResult;
    }

    return handler(request, authResult.user, ...args);
  };
}