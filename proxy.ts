import { NextResponse } from 'next/server';
import { auth, isAuthConfigured } from './auth';

const publicPathPrefixes = [
  '/api/auth',
  '/login',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/icons',
];

export const proxy = auth((request) => {
  if (!isAuthConfigured) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (publicPathPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (!request.auth) {
    const loginUrl = new URL('/login', request.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.href);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
