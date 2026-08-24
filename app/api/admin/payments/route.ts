import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const customerId = searchParams.get('customerId');

    let query = supabaseAdmin
      .from('order_payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (orderId) {
      query = query.eq('order_id', orderId);
    }
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, payments: data || [] });
  } catch (err: any) {
    console.error('Error fetching payments:', err);
    return NextResponse.json({ error: 'حدث خطأ في جلب الدفعات', details: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = checkAdminAuth(request);
    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, customerId, amount, note, createdAt } = body;

    if (!customerId && !orderId) {
      return NextResponse.json({ error: 'يرجى تحديد الزبون لتسجيل الدفعة' }, { status: 400 });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: 'يرجى إدخال مبلغ صحيح أكبر من الصفر' }, { status: 400 });
    }

    // Determine customer_id if not explicitly provided
    let finalCustomerId = customerId;
    if (!finalCustomerId && orderId) {
      const { data: orderData } = await supabaseAdmin
        .from('orders')
        .select('customer_id, customer_name')
        .eq('id', orderId)
        .single();

      if (orderData?.customer_id) {
        finalCustomerId = orderData.customer_id;
      } else if (orderData?.customer_name) {
        const { data: custData } = await supabaseAdmin
          .from('customers')
          .select('id')
          .eq('name', orderData.customer_name)
          .maybeSingle();
        if (custData?.id) {
          finalCustomerId = custData.id;
        }
      }
    }

    const newPayment = {
      order_id: orderId || null,
      customer_id: finalCustomerId || null,
      amount: numAmount,
      note: (note || '').trim() || null,
      created_at: createdAt || new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('order_payments')
      .insert(newPayment)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      payment: data,
      message: 'تم إضافة الدفعة بنجاح'
    });
  } catch (err: any) {
    console.error('Error creating payment:', err);
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة الدفعة', details: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = checkAdminAuth(request);
    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('id');

    if (!paymentId) {
      return NextResponse.json({ error: 'معرف الدفعة مطلوب' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('order_payments')
      .delete()
      .eq('id', paymentId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'تم حذف الدفعة بنجاح' });
  } catch (err: any) {
    console.error('Error deleting payment:', err);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الدفعة', details: err.message }, { status: 500 });
  }
}
