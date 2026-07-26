import { NextRequest } from 'next/server';

export interface AdminAuthResult {
  isAdmin: boolean;
  error?: string;
}

/**
 * Verify admin session from request cookies.
 * Re-uses the exact admin_session verification logic used in the existing app & proxy.ts.
 */
export function checkAdminAuth(request: NextRequest): AdminAuthResult {
  const adminCookie = request.cookies.get('admin_session');
  
  if (adminCookie && adminCookie.value === 'authenticated') {
    return { isAdmin: true };
  }
  
  return { isAdmin: false, error: 'Unauthorized: Admin authentication required' };
}
