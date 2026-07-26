import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { hashToken } from '@/lib/auth/crypto';

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
      .select('id, customer_id, status, customers(id, name, status, pin_hash)')
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

    // 5. Check if browser already has an active approved customer_device_session for this customer
    const approvedCookie = request.cookies.get('customer_device_session');
    if (approvedCookie?.value) {
      const sessionHash = hashToken(approvedCookie.value);
      const { data: sessionData } = await supabaseAdmin
        .from('customer_sessions')
        .select('id, expires_at, customer_id, customer_devices!inner(status)')
        .eq('session_token_hash', sessionHash)
        .maybeSingle();

      if (sessionData && sessionData.customer_id === customer.id) {
        const device = sessionData.customer_devices as any;
        const expiresAt = new Date(sessionData.expires_at).getTime();
        if (device?.status === 'approved' && expiresAt > Date.now()) {
          console.log('[VerifyLink] Active approved customer_device_session found. Bypassing PIN for customer:', customer.id);
          return NextResponse.json({
            success: true,
            alreadyApproved: true,
            redirectTo: '/',
            customerId: customer.id,
            customerName: customer.name
          }, { status: 200 });
        }
      }
    }

    // 6. Update last_used_at timestamp on the access link
    await supabaseAdmin
      .from('customer_access_links')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', linkData.id);

    return NextResponse.json({
      success: true,
      alreadyApproved: false,
      customerId: customer.id,
      customerName: customer.name,
      hasPin: Boolean(customer.pin_hash)
    }, { status: 200 });

  } catch (err: any) {
    console.error('Unhandled exception in verify-link API handler:', err);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ تقني غير متوقع في السيرفر' },
      { status: 500 }
    );
  }
}
