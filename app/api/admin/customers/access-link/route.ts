import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAuth } from '@/lib/auth/adminAuth';
import { generateRandomToken, hashToken, hashPin } from '@/lib/auth/crypto';

export async function GET(request: NextRequest) {
  const auth = checkAdminAuth(request);
  if (!auth.isAdmin) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');

  if (!customerId) {
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
  }

  try {
    const { data: linkData } = await supabaseAdmin
      .from('customer_access_links')
      .select('id, status, created_at, last_used_at')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .maybeSingle();

    const { data: customerData } = await supabaseAdmin
      .from('customers')
      .select('pin_hash, max_devices, show_prices, status')
      .eq('id', customerId)
      .single();

    return NextResponse.json({
      hasLink: Boolean(linkData),
      linkStatus: linkData?.status || null,
      lastUsedAt: linkData?.last_used_at || null,
      hasPin: Boolean(customerData?.pin_hash),
      maxDevices: customerData?.max_devices ?? 2,
      showPrices: customerData?.show_prices ?? true,
      customerStatus: customerData?.status || 'active'
    });
  } catch (err: any) {
    console.error('Error fetching access link info:', err);
    return NextResponse.json({ error: 'حدث خطأ في قراءة بيانات رابط الدخول' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = checkAdminAuth(request);
  if (!auth.isAdmin) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { customerId, action, pin, maxDevices } = await request.json();

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    if (action === 'set_pin' && pin) {
      const pinHash = hashPin(pin);
      const { error: pinError } = await supabaseAdmin
        .from('customers')
        .update({ pin_hash: pinHash })
        .eq('id', customerId);

      if (pinError) throw pinError;
      return NextResponse.json({ success: true, message: 'تم تحديث رمز PIN للزبون بنجاح' });
    }

    if (action === 'update_max_devices' && typeof maxDevices === 'number') {
      const { error: devError } = await supabaseAdmin
        .from('customers')
        .update({ max_devices: Math.max(1, maxDevices) })
        .eq('id', customerId);

      if (devError) throw devError;
      return NextResponse.json({ success: true, message: 'تم تحديث الحد الأقصى للأجهزة' });
    }

    // Action: generate or regenerate access link
    // 1. Revoke existing links
    await supabaseAdmin
      .from('customer_access_links')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('customer_id', customerId)
      .eq('status', 'active');

    // 2. Generate random unguessable raw token
    const rawToken = generateRandomToken(24);
    const tokenHash = hashToken(rawToken);

    // 3. Create new access link record
    const { error: insertError } = await supabaseAdmin
      .from('customer_access_links')
      .insert({
        customer_id: customerId,
        token_hash: tokenHash,
        status: 'active'
      });

    if (insertError) throw insertError;

    // Optional: if PIN provided during link creation, set it as well
    if (pin) {
      const pinHash = hashPin(pin);
      await supabaseAdmin
        .from('customers')
        .update({ pin_hash: pinHash })
        .eq('id', customerId);
    }

    // Construct full shareable URL
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const origin = host ? `${proto}://${host}` : (request.headers.get('origin') || '');
    const accessUrl = `${origin}/access/${rawToken}`;

    return NextResponse.json({
      success: true,
      accessUrl,
      rawToken,
      message: 'تم إنشاء رابط الدخول الخاص بنجاح'
    });
  } catch (err: any) {
    console.error('Error generating access link:', err);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء رابط الدخول' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = checkAdminAuth(request);
  if (!auth.isAdmin) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    await supabaseAdmin
      .from('customer_access_links')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('customer_id', customerId)
      .eq('status', 'active');

    return NextResponse.json({ success: true, message: 'تم إبطال رابط الدخول الخاص للزبون' });
  } catch (err: any) {
    console.error('Error revoking access link:', err);
    return NextResponse.json({ error: 'حدث خطأ أثناء إبطال رابط الدخول' }, { status: 500 });
  }
}
