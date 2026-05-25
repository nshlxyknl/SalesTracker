import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/signup'];
  
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check for auth token
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // For edge runtime, we'll do basic token validation
  // The actual JWT verification will happen in API routes
  try {
    // Basic token format check (JWT has 3 parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Decode payload without verification (just for role checking)
    const payload = JSON.parse(atob(parts[1]));
    
    // Check if token is expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Check admin routes
    if (pathname.startsWith('/admin') && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Check user routes
    if (pathname.startsWith('/dashboard') && !payload.userId) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    // If token parsing fails, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};