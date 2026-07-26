import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Static Next.js assets, public images, and favicons - allow directly
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.webp')
  ) {
    return NextResponse.next();
  }

  // 2. Admin Login Page - allow directly under existing admin auth system
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  // 3. Admin Routes & Admin APIs (/admin/* and /api/admin/*)
  // Protected STRICTLY by existing admin_session cookie. ZERO dependency on customer devices!
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const adminSession = request.cookies.get('admin_session');

    if (!adminSession || adminSession.value !== 'authenticated') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized admin access' },
          { status: 401 }
        );
      }
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 4. Customer Access & Onboarding Public Routes (/access/*, /api/access/*, /waiting-approval, /access-denied)
  // Explicitly allow onboarding API endpoints and public access pages without session checks or redirects.
  if (
    pathname.startsWith('/access') ||
    pathname.startsWith('/api/access') ||
    pathname === '/waiting-approval' ||
    pathname === '/access-denied'
  ) {
    return NextResponse.next();
  }

  // 5. Store Routes & Store APIs (/ , /checkout, /invoice/*, /api/store/*)
  // Check if Customer Device Protection is enabled via Server-only Feature Flag
  const isProtectionEnabled = process.env.ENABLE_CUSTOMER_DEVICE_PROTECTION !== 'false';

  if (isProtectionEnabled) {
    const approvedSession = request.cookies.get('customer_device_session');
    const pendingSession = request.cookies.get('customer_pending_session');

    // If no customer device session cookie exists at all
    if (!approvedSession && !pendingSession) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized store access: Device approval required' },
          { status: 401 }
        );
      }
      // Redirect unauthenticated visitor to status page
      const statusUrl = new URL('/access/status?reason=unauthorized', request.url);
      return NextResponse.redirect(statusUrl);
    }

    // If only pending session exists and visitor is trying to access store routes or APIs
    if (!approvedSession && pendingSession) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Device pending approval' },
          { status: 403 }
        );
      }
      const pendingUrl = new URL('/access/status?reason=pending', request.url);
      return NextResponse.redirect(pendingUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
