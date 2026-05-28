import { NextResponse } from 'next/server';

// Prevent static generation for this API route
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // Clear the auth token cookie
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0
  });

  return response;
}