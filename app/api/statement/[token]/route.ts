import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isOfferActive } from '@/lib/offerHelpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: 'الرابط غير صالح' }, { status: 400 });
    }

    // 1. Find customer by statement_token or ID
    let { data: customer, error: custError } = await supabaseAdmin
      .from('customers')
      .select('id, name, show_prices, statement_token, created_at')
      .eq('statement_token', token)
      .maybeSingle();

    if (!customer) {
      // Check by customer UUID directly
      const { data: custById } = await supabaseAdmin
        .from('customers')
        .select('id, name, show_prices, statement_token, created_at')
        .eq('id', token)
        .maybeSingle();

      if (custById) {
        customer = custById;
      }
    }

    if (!customer) {
      return NextResponse.json({ error: 'كشف الحساب غير موجود أو تم إلغاء الرابط' }, { status: 404 });
    }

    // 2. Fetch all orders for this customer
    const { data: ordersData, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        customer_id,
        customer_name,
        total_price,
        status,
        created_at,
        order_items (
          id,
          order_id,
          product_id,
          quantity,
          price_at_purchase,
          product_name,
          product_image,
          applied_offer,
          products (
            name,
            image_url,
            has_offer,
            offer_title,
            offer_type,
            offer_end_date,
            offer_max_quantity,
            offer_used_quantity
          )
        )
      `)
      .or(`customer_id.eq.${customer.id},customer_name.eq.${customer.name}`)
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    const ordersList = ordersData || [];
    const orderIds = ordersList.map((o: any) => o.id);

    // 3. Fetch all payments for these orders
    let paymentsList: any[] = [];
    if (orderIds.length > 0) {
      const { data: payData, error: payError } = await supabaseAdmin
        .from('order_payments')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: true });

      if (!payError && payData) {
        paymentsList = payData;
      }
    }

    // 4. Map payments to orders and calculate debts
    const showPrices = customer.show_prices ?? true;
    let totalInvoicesAmount = 0;
    let totalPaidAmount = 0;
    let unpaidCount = 0;
    let partialCount = 0;
    let paidCount = 0;

    const processedOrders: any[] = [];

    ordersList.forEach((order: any) => {
      const rawOrderTotal = (order.order_items || []).reduce(
        (sum: number, item: any) => sum + (Number(item.quantity) * Number(item.price_at_purchase || 0)),
        0
      );
      const effectiveOrderTotal = order.total_price !== undefined && order.total_price !== null 
        ? Number(order.total_price) 
        : rawOrderTotal;

      const orderPayments = paymentsList.filter((p: any) => p.order_id === order.id);
      const orderPaid = orderPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const orderRemaining = Math.max(0, effectiveOrderTotal - orderPaid);

      // Exclude old unpriced test orders (total 0 and paid 0) from statement view
      if (effectiveOrderTotal <= 0 && orderPaid <= 0) {
        return;
      }

      let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';
      if (effectiveOrderTotal > 0 && orderPaid >= effectiveOrderTotal) {
        paymentStatus = 'paid';
        paidCount++;
      } else if (orderPaid > 0) {
        paymentStatus = 'partial';
        partialCount++;
      } else {
        paymentStatus = 'unpaid';
        unpaidCount++;
      }

      totalInvoicesAmount += effectiveOrderTotal;
      totalPaidAmount += orderPaid;

      processedOrders.push({
        id: order.id,
        created_at: order.created_at,
        status: order.status,
        total_price: effectiveOrderTotal,
        paid_amount: orderPaid,
        remaining_amount: orderRemaining,
        payment_status: paymentStatus,
        payments: orderPayments.map((p: any) => ({
          id: p.id,
          amount: Number(p.amount || 0),
          note: p.note || null,
          created_at: p.created_at
        })),
        order_items: (order.order_items || []).map((item: any) => {
          const effectiveOffer = item.applied_offer || (item.products && isOfferActive(item.products) ? item.products.offer_title : null);
          return {
            id: item.id,
            product_name: item.product_name || item.products?.name || 'منتج',
            product_image: item.product_image || item.products?.image_url || null,
            quantity: item.quantity,
            price_at_purchase: Number(item.price_at_purchase || 0),
            applied_offer: effectiveOffer
          };
        })
      });
    });

    const totalRemainingDebt = Math.max(0, totalInvoicesAmount - totalPaidAmount);

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        show_prices: true,
        statement_token: customer.statement_token
      },
      summary: {
        total_invoices_amount: totalInvoicesAmount,
        total_paid_amount: totalPaidAmount,
        total_remaining_debt: totalRemainingDebt,
        unpaid_count: unpaidCount,
        partial_count: partialCount,
        paid_count: paidCount,
        total_invoices_count: processedOrders.length
      },
      orders: processedOrders
    });
  } catch (err: any) {
    console.error('Error loading customer statement API:', err);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب كشف الحساب', details: err.message }, { status: 500 });
  }
}
