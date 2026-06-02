import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenEdge, extractTokenFromCookies } from '@/lib/auth-edge';

// Define protected routes and their required roles
const PROTECTED_ROUTES = {
  '/admin': ['admin'],
  '/admin/van-stock': ['admin'],
  '/admin/sales': ['admin'],
  '/admin/stock-reconciliation': ['admin'],
  '/admin/export': ['admin'],
  '/dashboard': ['user', 'admin'],
  '/api/admin': ['admin'],
  '/api/sales': ['user', 'admin'],
  '/api/van-loads': ['admin'],
  '/api/van-load': ['admin'],
  '/api/reconciliation': ['admin'],
  '/api/stock-reconciliation': ['admin'],
  '/api/bill-submissions': ['user', 'admin'],
  '/api/export': ['admin'],
  '/api/users': ['admin'],
} as const;

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/api/auth/signin',
  '/api/auth/signup',
  '/api/auth/signout',
  '/manifest.json',
  '/serwist',
  '/~offline',
  '/offline.html',
  '/_next',
  '/icons',
  '/favicon.ico',
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => {
    if (route === '/_next') {
      return pathname.startsWith('/_next');
    }
    if (route === '/icons') {
      return pathname.startsWith('/icons');
    }
    if (route === '/serwist') {
      return pathname.startsWith('/serwist');
    }
    return pathname === route;
  });
}

function getRequiredRoles(pathname: string): string[] | null {
  // Check exact matches first
  if (pathname in PROTECTED_ROUTES) {
    return [...PROTECTED_ROUTES[pathname as keyof typeof PROTECTED_ROUTES]];
  }

  // Check prefix matches for API routes and admin routes
  for (const [route, roles] of Object.entries(PROTECTED_ROUTES)) {
    if (pathname.startsWith(route + '/')) {
      return [...roles];
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Get auth token from cookies
  const token = extractTokenFromCookies(request.headers.get('cookie'));

  if (!token) {
    // Redirect to login for protected routes
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token and get user info
  const decoded = verifyTokenEdge(token);
  if (!decoded) {
    // Invalid token, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('auth-token');
    return response;
  }

  // Check role-based access
  const requiredRoles = getRequiredRoles(pathname);
  if (requiredRoles && !requiredRoles.includes(decoded.role)) {
    // User doesn't have required role
    if (decoded.role === 'admin') {
      // Admin trying to access user route, redirect to admin dashboard
      return NextResponse.redirect(new URL('/admin', request.url));
    } else {
      // User trying to access admin route, redirect to user dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Add user info to request headers for API routes
  if (pathname.startsWith('/api/')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', decoded.userId);
    requestHeaders.set('x-user-role', decoded.role);
    requestHeaders.set('x-username', decoded.username);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};