import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { hashToken, generateRandomToken } from '@/lib/auth/crypto';

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

    // 1. Fetch access link record by token_hash
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

    // 2. Link not found (404)
    if (!linkData) {
      return NextResponse.json(
        { success: false, error: 'رابط الدخول الخاص غير موجود، يرجى التأكد من الرمز الصحيح.' },
        { status: 404 }
      );
    }

    // 3. Link revoked or expired (410)
    if (linkData.status === 'revoked' || linkData.status === 'expired') {
      return NextResponse.json(
        { success: false, error: 'رابط الدخول هذا ملغى أو منتهي الصلاحية، يرجى التواصل مع الإدارة للحصول على رابط جديد.' },
        { status: 410 }
      );
    }

    const customer = linkData.customers as any;

    // 4. Customer account suspended (403)
    if (!customer || customer.status === 'suspended') {
      return NextResponse.json(
        { success: false, error: 'حساب هذا الزبون موقوف حالياً، يرجى التواصل مع الإدارة.' },
        { status: 403 }
      );
    }

    // 5. Check if browser already has an active approved customer_device_session (from Cookie OR Header/Body backupToken)
    const approvedCookie = request.cookies.get('customer_device_session')?.value;
    const backupToken = body.backupToken || request.headers.get('x-customer-device-token');
    const tokenToCheck = approvedCookie || backupToken;

    if (tokenToCheck) {
      const sessionHash = hashToken(tokenToCheck);
      const { data: sessionData } = await supabaseAdmin
        .from('customer_sessions')
        .select('id, expires_at, customer_id, customer_devices!inner(status)')
        .eq('session_token_hash', sessionHash)
        .maybeSingle();

      if (sessionData && sessionData.customer_id === customer.id) {
        const device = sessionData.customer_devices as any;
        const expiresAt = new Date(sessionData.expires_at).getTime();
        if (device?.status === 'approved' && expiresAt > Date.now()) {
          console.log('[VerifyLink] Active approved session found for customer:', customer.id);
          const res = NextResponse.json({
            success: true,
            alreadyApproved: true,
            redirectTo: '/',
            customerId: customer.id,
            customerName: customer.name,
            sessionToken: tokenToCheck
          }, { status: 200 });

          // Refresh cookie if it was absent
          if (!approvedCookie && backupToken) {
            const DURATION_180_DAYS_SEC = 180 * 24 * 60 * 60;
            res.cookies.set('customer_device_session', backupToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: DURATION_180_DAYS_SEC
            });
          }

          return res;
        }
      }
    }

    // 6. Update last_used_at timestamp on the access link
    await supabaseAdmin
      .from('customer_access_links')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', linkData.id);

    const userAgent = request.headers.get('user-agent') || body.userAgent || '';
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = new Date().toISOString();

    // 7. Check if pending cookie / backup pending token exists
    const pendingCookie = request.cookies.get('customer_pending_session')?.value;
    const backupPendingToken = body.backupPendingToken || request.headers.get('x-customer-pending-token');
    const pendingToCheck = pendingCookie || backupPendingToken;

    if (pendingToCheck) {
      const pendingHash = hashToken(pendingToCheck);
      const { data: existingDevice } = await supabaseAdmin
        .from('customer_devices')
        .select('id, status, customer_id')
        .eq('device_token_hash', pendingHash)
        .maybeSingle();

      if (existingDevice && existingDevice.customer_id === customer.id) {
        await supabaseAdmin
          .from('customer_devices')
          .update({ last_seen_at: now, last_ip: ip })
          .eq('id', existingDevice.id);

        const res = NextResponse.json({
          success: true,
          status: existingDevice.status,
          customerName: customer.name,
          pendingToken: pendingToCheck,
          alreadyApproved: existingDevice.status === 'approved',
          redirectTo: existingDevice.status === 'approved' ? '/' : '/access/status?reason=pending'
        });

        return res;
      }
    }

    // 8. Count current approved devices
    const { count: approvedCount } = await supabaseAdmin
      .from('customer_devices')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer.id)
      .eq('status', 'approved');

    const maxDevices = customer.max_devices || 2;
    const isOverLimit = (approvedCount || 0) >= maxDevices;

    // 9. Automatically register new device in customer_devices
    const deviceToken = generateRandomToken(32);
    const deviceTokenHash = hashToken(deviceToken);

    const { data: newDeviceData, error: deviceError } = await supabaseAdmin
      .from('customer_devices')
      .insert({
        customer_id: customer.id,
        device_token_hash: deviceTokenHash,
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

    const DURATION_180_DAYS_SEC = 180 * 24 * 60 * 60;
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

    // Set pending cookie
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
