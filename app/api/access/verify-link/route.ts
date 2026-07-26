import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { hashToken } from '@/lib/auth/crypto';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'رمز الدخول غير صحيح' }, { status: 400 });
    }

    const tokenHash = hashToken(token.trim());

    // Find active access link
    const { data: linkData, error: linkError } = await supabaseAdmin
      .from('customer_access_links')
      .select('id, customer_id, status, customers(id, name, status, pin_hash)')
      .eq('token_hash', tokenHash)
      .eq('status', 'active')
      .single();

    if (linkError || !linkData) {
      return NextResponse.json(
        { error: 'رابط الدخول هذا غير صالح أو تم إلغاؤه من قبل الإدارة.' },
        { status: 404 }
      );
    }

    const customer = linkData.customers as any;

    if (!customer || customer.status === 'suspended') {
      return NextResponse.json(
        { error: 'حساب هذا الزبون موقوف حالياً، يرجى التواصل مع الإدارة.' },
        { status: 403 }
      );
    }

    // Update last_used_at timestamp on the access link
    await supabaseAdmin
      .from('customer_access_links')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', linkData.id);

    return NextResponse.json({
      success: true,
      customerId: customer.id,
      customerName: customer.name,
      hasPin: Boolean(customer.pin_hash)
    });
  } catch (err: any) {
    console.error('Error in verify-link:', err);
    return NextResponse.json({ error: 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}
