import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { hashToken, generateRandomToken } from '@/lib/auth/crypto';

export async function GET(request: NextRequest) {
  try {
    const approvedCookie = request.cookies.get('customer_device_session');
    const pendingCookie = request.cookies.get('customer_pending_session');

    // 1. If already has approved device session
    if (approvedCookie?.value) {
      const sessionHash = hashToken(approvedCookie.value);
      const { data: sessionData } = await supabaseAdmin
        .from('customer_sessions')
        .select('id, expires_at, customer_devices!inner(id, status)')
        .eq('session_token_hash', sessionHash)
        .maybeSingle();

      if (sessionData) {
        const device = sessionData.customer_devices as any;
        if (device?.status === 'approved') {
          console.log('[DeviceStatus] Active approved customer_device_session found for device_id:', device.id);
          return NextResponse.json({
            approved: true,
            status: 'approved',
            redirectTo: '/'
          });
        }
      }
    }

    // 2. If has pending device cookie, check DB for status upgrade
    if (pendingCookie?.value) {
      const deviceHash = hashToken(pendingCookie.value);
      
      const { data: deviceData, error: deviceError } = await supabaseAdmin
        .from('customer_devices')
        .select('id, customer_id, status, customers(status)')
        .eq('device_token_hash', deviceHash)
        .maybeSingle();

      if (deviceError) {
        console.error('[DeviceStatus] Database lookup error:', deviceError);
        return NextResponse.json({ approved: false, status: 'error', error: 'Database lookup error' }, { status: 500 });
      }

      if (!deviceData) {
        console.log('[DeviceStatus] Pending device record not found in DB');
        return NextResponse.json({ approved: false, status: 'unauthorized', redirectUrl: '/access/status?reason=unauthorized' });
      }

      const customer = deviceData.customers as any;
      if (customer?.status === 'suspended') {
        console.log('[DeviceStatus] Customer account suspended for device_id:', deviceData.id);
        return NextResponse.json({ approved: false, status: 'suspended', redirectUrl: '/access/status?reason=suspended' });
      }

      const currentStatus = deviceData.status;
      console.log('[DeviceStatus] Checked pending cookie, device_id:', deviceData.id, 'DB status:', currentStatus);

      if (currentStatus === 'pending') {
        return NextResponse.json({
          approved: false,
          status: 'pending'
        });
      }

      if (currentStatus === 'rejected' || currentStatus === 'blocked' || currentStatus === 'revoked') {
        return NextResponse.json({
          approved: false,
          status: currentStatus,
          redirectUrl: `/access/status?reason=${currentStatus}`
        });
      }

      // 3. Status is APPROVED! Upgrade session from pending to full customer_device_session
      if (currentStatus === 'approved') {
        const sessionToken = generateRandomToken(32);
        const sessionTokenHash = hashToken(sessionToken);
        const DURATION_180_DAYS_MS = 180 * 24 * 60 * 60 * 1000;
        const DURATION_180_DAYS_SEC = 180 * 24 * 60 * 60;
        const expiresAt = new Date(Date.now() + DURATION_180_DAYS_MS).toISOString();

        // Create new customer session in DB
        const { error: sessionInsertErr } = await supabaseAdmin
          .from('customer_sessions')
          .insert({
            customer_id: deviceData.customer_id,
            device_id: deviceData.id,
            session_token_hash: sessionTokenHash,
            expires_at: expiresAt
          });

        if (sessionInsertErr) {
          console.error('[DeviceStatus] Failed to insert customer session:', sessionInsertErr);
          return NextResponse.json({ approved: false, status: 'error', error: 'Failed to create session' }, { status: 500 });
        }

        console.log('[DeviceStatus] Successfully upgraded approved device session for device_id:', deviceData.id);

        const response = NextResponse.json({
          approved: true,
          status: 'approved',
          redirectTo: '/'
        });

        // Set persistent approved customer_device_session cookie (180 days)
        response.cookies.set('customer_device_session', sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: DURATION_180_DAYS_SEC
        });

        // Clear pending cookie
        response.cookies.set('customer_pending_session', '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 0
        });

        return response;
      }
    }

    return NextResponse.json({
      approved: false,
      status: 'unauthorized',
      redirectUrl: '/access/status?reason=unauthorized'
    });
  } catch (err: any) {
    console.error('[DeviceStatus] Exception in GET /api/access/status:', err);
    return NextResponse.json({ approved: false, status: 'error', error: 'Internal server error' }, { status: 500 });
  }
}
