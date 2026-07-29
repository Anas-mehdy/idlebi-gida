import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { hashToken, verifyPin, generateRandomToken } from '@/lib/auth/crypto';

export async function POST(request: NextRequest) {
  try {
    const { token, pin, deviceName, browser, os } = await request.json();

    if (!token || !pin) {
      return NextResponse.json({ error: 'يرجى إدخال رمز الرابط ورقم PIN' }, { status: 400 });
    }

    const tokenHash = hashToken(token.trim());

    // 1. Fetch access link & customer
    const { data: linkData, error: linkError } = await supabaseAdmin
      .from('customer_access_links')
      .select('id, customer_id, customers(id, name, status, pin_hash, max_devices)')
      .eq('token_hash', tokenHash)
      .single();

    if (linkError || !linkData) {
      return NextResponse.json({ error: 'رابط الدخول غير صالح أو تم إلغاؤه' }, { status: 404 });
    }

    const customer = linkData.customers as any;

    if (customer.status === 'suspended') {
      return NextResponse.json({ error: 'حساب هذا الزبون موقوف حالياً' }, { status: 403 });
    }

    // 2. Verify PIN
    const isValidPin = verifyPin(pin.trim(), customer.pin_hash);
    if (!isValidPin) {
      // Log security event
      await supabaseAdmin.from('security_events').insert({
        customer_id: customer.id,
        event_type: 'pin_failed',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        metadata: { token_hash: tokenHash }
      });

      return NextResponse.json({ error: 'رمز PIN غير صحيح، يرجى المحاولة مجدداً.' }, { status: 401 });
    }

    // Log successful PIN verification
    await supabaseAdmin.from('security_events').insert({
      customer_id: customer.id,
      event_type: 'pin_verified',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    });

    // 3. Check if browser already has an active approved customer_device_session
    const approvedCookie = request.cookies.get('customer_device_session');
    if (approvedCookie?.value) {
      const sessionHash = hashToken(approvedCookie.value);
      const { data: activeSession } = await supabaseAdmin
        .from('customer_sessions')
        .select('id, expires_at, customer_id, customer_devices!inner(id, status)')
        .eq('session_token_hash', sessionHash)
        .maybeSingle();

      if (activeSession && activeSession.customer_id === customer.id) {
        const dev = activeSession.customer_devices as any;
        if (dev?.status === 'approved' && new Date(activeSession.expires_at).getTime() > Date.now()) {
          console.log('[VerifyPin] Active approved session found. Bypassing duplicate device creation.');
          return NextResponse.json({
            success: true,
            status: 'approved',
            alreadyApproved: true,
            redirectTo: '/'
          });
        }
      }
    }

    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = new Date().toISOString();

    // 4. Check if pending cookie exists matching an existing device
    const pendingCookie = request.cookies.get('customer_pending_session');
    if (pendingCookie?.value) {
      const pendingHash = hashToken(pendingCookie.value);
      const { data: existingDevice } = await supabaseAdmin
        .from('customer_devices')
        .select('id, status, customer_id')
        .eq('device_token_hash', pendingHash)
        .maybeSingle();

      if (existingDevice && existingDevice.customer_id === customer.id) {
        console.log('[VerifyPin] Reusing existing pending device record:', existingDevice.id);
        await supabaseAdmin
          .from('customer_devices')
          .update({ last_seen_at: now, last_ip: ip })
          .eq('id', existingDevice.id);

        return NextResponse.json({
          success: true,
          status: existingDevice.status,
          customerName: customer.name,
          message: existingDevice.status === 'approved' ? 'الجهاز معتمد بالفعل' : 'طلب الجهاز معلق وبانتظار موافقة الأدمن.'
        });
      }
    }


    // 6. Count current approved devices
    const { count: approvedCount } = await supabaseAdmin
      .from('customer_devices')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer.id)
      .eq('status', 'approved');

    const maxDevices = customer.max_devices || 2;
    const isOverLimit = (approvedCount || 0) >= maxDevices;

    // 7. Create new device request if no match exists
    const deviceToken = generateRandomToken(32);
    const deviceTokenHash = hashToken(deviceToken);

    const { data: newDeviceData, error: deviceError } = await supabaseAdmin
      .from('customer_devices')
      .insert({
        customer_id: customer.id,
        device_token_hash: deviceTokenHash,
        status: 'pending',
        device_name: deviceName || 'متصفح جديد',
        browser: browser || 'غير معروف',
        operating_system: os || 'غير معروف',
        user_agent: userAgent,
        first_ip: ip,
        last_ip: ip
      })
      .select('id, status')
      .single();

    if (deviceError) {
      throw deviceError;
    }

    console.log('[VerifyPin] Created new device request:', newDeviceData.id);

    const response = NextResponse.json({
      success: true,
      status: 'pending',
      isOverLimit,
      customerName: customer.name,
      message: isOverLimit 
        ? 'تم طلب إضافة جهاز جديد، ولكن حسابك وصل للحد الأقصى. يرجى تواصل الإدارة لزيادة حد الأجهزة أو الاعتماد.'
        : 'تم تسجيل الطلب بنجاح وهو بانتظار موافقة الأدمن.'
    });

    response.cookies.set('customer_pending_session', deviceToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days pending duration
    });

    return response;
  } catch (err: any) {
    console.error('Error in verify-pin:', err);
    return NextResponse.json({ error: 'حدث خطأ أثناء معالجة طلب الاعتماد' }, { status: 500 });
  }
}
