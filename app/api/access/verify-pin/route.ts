import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hashToken, verifyPin, generateRandomToken } from '@/lib/auth/crypto';

export async function POST(request: NextRequest) {
  try {
    const { token, pin, deviceName, browser, os } = await request.json();

    if (!token || !pin) {
      return NextResponse.json({ error: 'يرجى إدخال رمز الرابط ورقم PIN' }, { status: 400 });
    }

    const tokenHash = hashToken(token.trim());

    // 1. Fetch access link & customer
    const { data: linkData, error: linkError } = await supabase
      .from('customer_access_links')
      .select('id, customer_id, customers(id, name, status, pin_hash, max_devices)')
      .eq('token_hash', tokenHash)
      .eq('status', 'active')
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
      await supabase.from('security_events').insert({
        customer_id: customer.id,
        event_type: 'pin_failed',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        metadata: { token_hash: tokenHash }
      });

      return NextResponse.json({ error: 'رمز PIN غير صحيح، يرجى المحاولة مجدداً.' }, { status: 401 });
    }

    // Log successful PIN verification
    await supabase.from('security_events').insert({
      customer_id: customer.id,
      event_type: 'pin_verified',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    });

    // 3. Count current approved devices
    const { count: approvedCount } = await supabase
      .from('customer_devices')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer.id)
      .eq('status', 'approved');

    const maxDevices = customer.max_devices || 2;
    const isOverLimit = (approvedCount || 0) >= maxDevices;

    // 4. Create new device request
    const deviceToken = generateRandomToken(32);
    const deviceTokenHash = hashToken(deviceToken);

    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    const { data: deviceData, error: deviceError } = await supabase
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

    // 5. Create Pending Device Cookie (Limited access)
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
