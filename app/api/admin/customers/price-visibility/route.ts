import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

export async function POST(request: NextRequest) {
  const auth = checkAdminAuth(request);
  if (!auth.isAdmin) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { customerId, showPrices } = await request.json();

    if (!customerId || typeof showPrices !== 'boolean') {
      return NextResponse.json({ error: 'customerId and showPrices (boolean) are required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('customers')
      .update({ show_prices: showPrices })
      .eq('id', customerId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      showPrices,
      message: `تم ${showPrices ? 'تفعيل' : 'إيقاف'} إظهار الأسعار للزبون بنجاح`
    });
  } catch (err: any) {
    console.error('Error updating price visibility:', err);
    return NextResponse.json({ error: 'حدث خطأ أثناء تعديل إعداد الأسعار' }, { status: 500 });
  }
}
