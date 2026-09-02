import { NextResponse, type NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'secureye_hrms_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow internal Next.js assets, public images, and public auth endpoints
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/logout') ||
    pathname.startsWith('/api/auth/forgot-password') ||
    pathname.startsWith('/api/passkeys/login') ||
    pathname.startsWith('/api/passkeys/check') ||
    pathname.startsWith('/api/devices/sync/push') ||
    pathname.startsWith('/kernn-') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js')
  ) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value || bearerToken;

  // 2. If user is NOT logged in
  if (!token) {
    if (pathname === '/login') {
      return NextResponse.next();
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 3. User is logged in: validate token expiration and redirection
  try {
    const [payloadBase64] = token.split('.');
    if (payloadBase64) {
      const decoded = JSON.parse(
        Buffer.from(payloadBase64, 'base64url').toString('utf-8')
      );

      // Check if session token expired
      if (Date.now() > decoded.expiresAt) {
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete(AUTH_COOKIE_NAME);
        return response;
      }

      // If user must change password, restrict to /login and change-password API
      if (decoded.mustChangePassword && pathname !== '/login' && !pathname.startsWith('/api/auth/change-password')) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      // If user is already authenticated and visits /login, redirect directly to dashboard
      if (pathname === '/login' && !decoded.mustChangePassword) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  } catch {
    // Malformed session cookie
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
