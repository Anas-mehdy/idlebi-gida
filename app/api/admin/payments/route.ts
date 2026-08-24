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

    // Find a fallback order_id for the customer if order_id is null (to satisfy NOT NULL DB constraints if migration wasn't run)
    let fallbackOrderId = orderId || null;
    if (!fallbackOrderId && finalCustomerId) {
      // 1. Try by customer_id
      const { data: orderById } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('customer_id', finalCustomerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orderById?.id) {
        fallbackOrderId = orderById.id;
      } else {
        // 2. Try by customer name
        const { data: cust } = await supabaseAdmin
          .from('customers')
          .select('name')
          .eq('id', finalCustomerId)
          .maybeSingle();

        if (cust?.name) {
          const { data: orderByName } = await supabaseAdmin
            .from('orders')
            .select('id')
            .eq('customer_name', cust.name)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (orderByName?.id) {
            fallbackOrderId = orderByName.id;
          }
        }
      }
    }

    // Attempt 1: Insert with customer_id and fallbackOrderId
    let newPayment: any = {
      order_id: fallbackOrderId || orderId || null,
      customer_id: finalCustomerId || null,
      amount: numAmount,
      note: (note || '').trim() || null,
      created_at: createdAt || new Date().toISOString()
    };

    let { data, error } = await supabaseAdmin
      .from('order_payments')
      .insert(newPayment)
      .select()
      .single();

    // Fallback 1: If column customer_id doesn't exist yet on order_payments table
    if (error && (error.message?.includes('customer_id') || error.code === '42703')) {
      console.warn('customer_id column not found in order_payments, retrying without customer_id');
      const retryPayment = {
        order_id: fallbackOrderId || orderId || null,
        amount: numAmount,
        note: (note || '').trim() || null,
        created_at: createdAt || new Date().toISOString()
      };
      const retryRes = await supabaseAdmin
        .from('order_payments')
        .insert(retryPayment)
        .select()
        .single();
      data = retryRes.data;
      error = retryRes.error;
    }

    // Fallback 2: If order_id NOT NULL constraint fails and no fallbackOrderId was found
    if (error && error.message?.includes('violates not-null constraint') && !fallbackOrderId) {
      // Create a zero-amount adjustment order for the customer so payment can attach to it
      const { data: cust } = await supabaseAdmin
        .from('customers')
        .select('name')
        .eq('id', finalCustomerId)
        .maybeSingle();

      const { data: adjOrder } = await supabaseAdmin
        .from('orders')
        .insert({
          customer_id: finalCustomerId,
          customer_name: cust?.name || 'دفتر الحساب',
          total_price: 0,
          status: 'delivered'
        })
        .select('id')
        .single();

      if (adjOrder?.id) {
        const retryWithAdj = {
          order_id: adjOrder.id,
          customer_id: finalCustomerId || null,
          amount: numAmount,
          note: (note || '').trim() || null,
          created_at: createdAt || new Date().toISOString()
        };
        const retryRes = await supabaseAdmin
          .from('order_payments')
          .insert(retryWithAdj)
          .select()
          .single();
        data = retryRes.data;
        error = retryRes.error;
      }
    }

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
