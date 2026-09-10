import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { hashToken, generateRandomToken } from '@/lib/auth/crypto';

const DURATION_180_DAYS_SEC = 180 * 24 * 60 * 60;
const DURATION_180_DAYS_MS = 180 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || !body.token || typeof body.token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'رمز رابط الدخول مفقود أو غير صحيح' },
        { status: 400 }
      );
    }

    const token = body.token.trim();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'رمز رابط الدخول فارغ' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);
    const approvedCookie = request.cookies.get('customer_device_session')?.value;
    const backupToken = body.backupToken || request.headers.get('x-customer-device-token');
    const tokenToCheck = approvedCookie || backupToken;

    const pendingCookie = request.cookies.get('customer_pending_session')?.value;
    const backupPendingToken = body.backupPendingToken || request.headers.get('x-customer-pending-token');
    const pendingToCheck = pendingCookie || backupPendingToken;

    const userAgent = request.headers.get('user-agent') || body.userAgent || '';
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = new Date().toISOString();
    const fingerprint = body.fingerprint ? hashToken(body.fingerprint) : null;

    // 1. First: Check if this browser ALREADY has an active approved customer_device_session
    if (tokenToCheck) {
      const sessionHash = hashToken(tokenToCheck);
      const { data: sessionData } = await supabaseAdmin
        .from('customer_sessions')
        .select(`
          id,
          expires_at,
          customer_id,
          device_id,
          customer_devices!inner(id, status, device_name),
          customers!inner(id, name, status)
        `)
        .eq('session_token_hash', sessionHash)
        .maybeSingle();

      if (sessionData) {
        const customer = sessionData.customers as any;
        const device = sessionData.customer_devices as any;
        const expiresAt = new Date(sessionData.expires_at).getTime();

        if (customer?.status === 'suspended') {
          return NextResponse.json(
            { success: false, error: 'حساب هذا الزبون موقوف حالياً، يرجى التواصل مع الإدارة.' },
            { status: 403 }
          );
        }

        if (device?.status === 'approved' && expiresAt > Date.now()) {
          console.log('[VerifyLink] Active approved session found for customer:', customer.id);
          
          // Update device activity
          await supabaseAdmin
            .from('customer_devices')
            .update({ last_seen_at: now, last_ip: ip })
            .eq('id', device.id);

          const res = NextResponse.json({
            success: true,
            alreadyApproved: true,
            redirectTo: '/',
            customerId: customer.id,
            customerName: customer.name,
            sessionToken: tokenToCheck
          }, { status: 200 });

          // Always ensure persistent cookie is freshly refreshed (180 days)
          res.cookies.set('customer_device_session', tokenToCheck, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: DURATION_180_DAYS_SEC
          });

          // Clear any leftover pending cookie
          res.cookies.set('customer_pending_session', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0
          });

          return res;
        }
      }
    }

    // 2. Fetch access link record by token_hash
    const { data: linkData, error: linkError } = await supabaseAdmin
      .from('customer_access_links')
      .select('id, customer_id, status, customers(id, name, status, max_devices)')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (linkError) {
      console.error('Database error in verify-link lookup:', linkError);
      return NextResponse.json(
        { success: false, error: 'حدث خطأ تقني في قاعدة البيانات أثناء البحث عن الرابط' },
        { status: 500 }
      );
    }

    // Link not found
    if (!linkData) {
      return NextResponse.json(
        { success: false, error: 'رابط الدخول الخاص غير موجود، يرجى التأكد من الرمز الصحيح.' },
        { status: 404 }
      );
    }

    const customer = linkData.customers as any;

    // Customer suspended
    if (!customer || customer.status === 'suspended') {
      return NextResponse.json(
        { success: false, error: 'حساب هذا الزبون موقوف حالياً، يرجى التواصل مع الإدارة.' },
        { status: 403 }
      );
    }

    // Helper function to issue an approved session to the client
    const issueApprovedSession = async (deviceId: string) => {
      const newSessionToken = generateRandomToken(32);
      const newSessionHash = hashToken(newSessionToken);
      const expiresAt = new Date(Date.now() + DURATION_180_DAYS_MS).toISOString();

      await supabaseAdmin.from('customer_sessions').insert({
        customer_id: customer.id,
        device_id: deviceId,
        session_token_hash: newSessionHash,
        expires_at: expiresAt
      });

      await supabaseAdmin
        .from('customer_devices')
        .update({
          last_seen_at: now,
          last_ip: ip,
          ...(fingerprint ? { fingerprint_hash: fingerprint } : {})
        })
        .eq('id', deviceId);

      const res = NextResponse.json({
        success: true,
        alreadyApproved: true,
        status: 'approved',
        sessionToken: newSessionToken,
        customerName: customer.name,
        customerId: customer.id,
        redirectTo: '/'
      }, { status: 200 });

      res.cookies.set('customer_device_session', newSessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: DURATION_180_DAYS_SEC
      });

      res.cookies.set('customer_pending_session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0
      });

      return res;
    };

    // 3. Check if visitor has an existing pending or previously recognized device record
    if (pendingToCheck) {
      const pendingHash = hashToken(pendingToCheck);
      const { data: existingDevice } = await supabaseAdmin
        .from('customer_devices')
        .select('id, status, customer_id')
        .eq('device_token_hash', pendingHash)
        .maybeSingle();

      if (existingDevice && existingDevice.customer_id === customer.id) {
        if (existingDevice.status === 'approved') {
          console.log('[VerifyLink] Existing approved device recognized from pendingToken. Upgrading session.');
          return await issueApprovedSession(existingDevice.id);
        } else if (existingDevice.status === 'pending') {
          return NextResponse.json({
            success: true,
            status: 'pending',
            customerName: customer.name,
            pendingToken: pendingToCheck,
            alreadyApproved: false,
            redirectTo: '/access/status?reason=pending'
          });
        } else if (existingDevice.status === 'blocked' || existingDevice.status === 'rejected') {
          return NextResponse.json({
            success: false,
            status: existingDevice.status,
            redirectTo: `/access/status?reason=${existingDevice.status}`
          });
        }
      }
    }

    // 4. Smart Device Matching: Check if customer ALREADY has an approved device matching this phone/browser
    // (Resolves WhatsApp In-App Browser vs System Browser cookie disconnects and Safari ITP cookie purges)
    const { data: approvedDevices } = await supabaseAdmin
      .from('customer_devices')
      .select('id, browser, operating_system, user_agent, fingerprint_hash, status, last_ip')
      .eq('customer_id', customer.id)
      .eq('status', 'approved')
      .order('last_seen_at', { ascending: false });

    if (approvedDevices && approvedDevices.length > 0) {
      // Check 1: exact fingerprint match
      const fpMatch = fingerprint 
        ? approvedDevices.find(d => d.fingerprint_hash === fingerprint)
        : null;

      // Check 2: matching OS and Browser (e.g. "iOS - Safari" or "Android - Chrome")
      const metaMatch = approvedDevices.find(d => {
        const osMatch = d.operating_system && body.os && d.operating_system.toLowerCase() === body.os.toLowerCase();
        const browserMatch = d.browser && body.browser && d.browser.toLowerCase() === body.browser.toLowerCase();
        return osMatch && browserMatch;
      });

      const matchedDevice = fpMatch || metaMatch;

      if (matchedDevice) {
        console.log('[VerifyLink] Smart Device Match: Re-authenticating existing approved device without duplicate notification:', matchedDevice.id);
        return await issueApprovedSession(matchedDevice.id);
      }
    }

    // 5. If not recognized as an approved device, check link status:
    // If link is revoked or expired -> 410
    if (linkData.status === 'revoked' || linkData.status === 'expired') {
      return NextResponse.json(
        { success: false, error: 'رابط الدخول هذا ملغى أو منتهي الصلاحية، يرجى التواصل مع الإدارة للحصول على رابط جديد.' },
        { status: 410 }
      );
    }

    // Update last_used_at on the access link
    await supabaseAdmin
      .from('customer_access_links')
      .update({ last_used_at: now })
      .eq('id', linkData.id);

    // 6. Check max_devices limit
    const { count: approvedCount } = await supabaseAdmin
      .from('customer_devices')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer.id)
      .eq('status', 'approved');

    const maxDevices = customer.max_devices || 2;
    const isOverLimit = (approvedCount || 0) >= maxDevices;

    // 7. Register new device in customer_devices
    const deviceToken = generateRandomToken(32);
    const deviceTokenHash = hashToken(deviceToken);

    const { data: newDeviceData, error: deviceError } = await supabaseAdmin
      .from('customer_devices')
      .insert({
        customer_id: customer.id,
        device_token_hash: deviceTokenHash,
        fingerprint_hash: fingerprint,
        status: 'pending',
        device_name: body.deviceName || 'متصفح جديد',
        browser: body.browser || 'غير معروف',
        operating_system: body.os || 'غير معروف',
        user_agent: userAgent,
        first_ip: ip,
        last_ip: ip
      })
      .select('id, status')
      .single();

    if (deviceError) {
      console.error('Error inserting new device in verify-link:', deviceError);
      return NextResponse.json({ success: false, error: 'تعذر تسجيل الجهاز الجديد' }, { status: 500 });
    }

    console.log('[VerifyLink] New device registered as pending:', newDeviceData.id);

    const response = NextResponse.json({
      success: true,
      status: 'pending',
      pendingToken: deviceToken,
      customerName: customer.name,
      deviceId: newDeviceData.id,
      isOverLimit,
      approvedCount: approvedCount || 0,
      maxDevices,
      redirectTo: isOverLimit 
        ? `/access/status?reason=limit_reached&approved=${approvedCount || 0}&max=${maxDevices}`
        : '/access/status?reason=pending'
    }, { status: 200 });

    response.cookies.set('customer_pending_session', deviceToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: DURATION_180_DAYS_SEC
    });

    return response;

  } catch (err: any) {
    console.error('Unhandled exception in verify-link API handler:', err);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ تقني غير متوقع في السيرفر' },
      { status: 500 }
    );
  }
}
