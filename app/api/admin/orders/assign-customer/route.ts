import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

export async function POST(request: NextRequest) {
  try {
    const auth = checkAdminAuth(request);
    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { orderId, customerId } = await request.json();

    if (!orderId || !customerId) {
      return NextResponse.json({ error: 'orderId and customerId are required' }, { status: 400 });
    }

    // 1. Fetch customer details
    const { data: customer, error: custError } = await supabaseAdmin
      .from('customers')
      .select('id, name')
      .eq('id', customerId)
      .single();

    if (custError || !customer) {
      return NextResponse.json({ error: 'الزبون غير موجود في قاعدة البيانات' }, { status: 404 });
    }

    // 2. Update order
    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .update({
        customer_id: customer.id,
        customer_name: customer.name
      })
      .eq('id', orderId);

    if (orderError) throw orderError;

    // 3. Update any payments linked to this order
    await supabaseAdmin
      .from('order_payments')
      .update({ customer_id: customer.id })
      .eq('order_id', orderId);

    return NextResponse.json({
      success: true,
      message: `تم ربط الفاتورة بالزبون "${customer.name}" بنجاح`,
      customer
    });
  } catch (err: any) {
    console.error('Error assigning order to customer:', err);
    return NextResponse.json({ error: 'حدث خطأ أثناء ربط الفاتورة بالزبون', details: err.message }, { status: 500 });
  }
}
