import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

export async function GET(request: NextRequest) {
  try {
    const auth = checkAdminAuth(request);
    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    // 1. Fetch all customers
    const { data: customersData, error: custError } = await supabaseAdmin
      .from('customers')
      .select('id, name, show_prices, statement_token, created_at')
      .order('name', { ascending: true });

    if (custError) throw custError;
    const customers = customersData || [];

    // Ensure all customers have a statement_token
    for (const c of customers) {
      if (!c.statement_token) {
        const token = c.id.replace(/-/g, '');
        c.statement_token = token;
        await supabaseAdmin
          .from('customers')
          .update({ statement_token: token })
          .eq('id', c.id);
      }
    }

    // 2. Fetch all orders with items
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
          applied_offer
        )
      `)
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;
    const orders = ordersData || [];

    // 3. Fetch all payments
    const { data: paymentsData, error: payError } = await supabaseAdmin
      .from('order_payments')
      .select('*')
      .order('created_at', { ascending: true });

    if (payError) throw payError;
    const payments = paymentsData || [];

    // Map customers by ID and Name for fast matching
    const customerById = new Map<string, any>();
    const customerByName = new Map<string, any>();
    customers.forEach(c => {
      customerById.set(c.id, c);
      customerByName.set(c.name.trim().toLowerCase(), c);
    });

    // Track unassigned orders
    const unassignedOrders: any[] = [];

    // Group orders and payments by customer
    const customerOrdersMap = new Map<string, any[]>();
    const customerPaymentsMap = new Map<string, any[]>();

    customers.forEach(c => {
      customerOrdersMap.set(c.id, []);
      customerPaymentsMap.set(c.id, []);
    });

    orders.forEach(order => {
      let matchedCustId = order.customer_id;
      if (!matchedCustId && order.customer_name) {
        const matched = customerByName.get(order.customer_name.trim().toLowerCase());
        if (matched) {
          matchedCustId = matched.id;
        }
      }

      if (matchedCustId && customerOrdersMap.has(matchedCustId)) {
        customerOrdersMap.get(matchedCustId)!.push(order);
      } else {
        unassignedOrders.push(order);
      }
    });

    payments.forEach(payment => {
      let custId = payment.customer_id;
      if (!custId && payment.order_id) {
        const ord = orders.find(o => o.id === payment.order_id);
        if (ord) {
          custId = ord.customer_id || (ord.customer_name ? customerByName.get(ord.customer_name.trim().toLowerCase())?.id : null);
        }
      }

      if (custId && customerPaymentsMap.has(custId)) {
        customerPaymentsMap.get(custId)!.push(payment);
      }
    });

    const origin = request.headers.get('origin') || 'https://store.example.com';

    let grandTotalInvoices = 0;
    let grandTotalPaid = 0;
    let grandTotalDebt = 0;
    let customersWithDebtCount = 0;

    const customerSummaries = customers.map(cust => {
      const custOrders = customerOrdersMap.get(cust.id) || [];
      const custPayments = customerPaymentsMap.get(cust.id) || [];

      let custTotalInvoices = 0;
      let custTotalPaid = 0;
      let unpaidCount = 0;
      let partialCount = 0;
      let paidCount = 0;

      const processedCustOrders = custOrders.map(order => {
        const rawTotal = (order.order_items || []).reduce(
          (sum: number, it: any) => sum + (Number(it.quantity) * Number(it.price_at_purchase || 0)),
          0
        );
        const orderTotal = order.total_price !== undefined && order.total_price !== null
          ? Number(order.total_price)
          : rawTotal;

        const orderPays = payments.filter(p => p.order_id === order.id);
        const orderPaid = orderPays.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const orderRemaining = Math.max(0, orderTotal - orderPaid);

        let status: 'unpaid' | 'partial' | 'paid' = 'unpaid';
        if (orderTotal > 0 && orderPaid >= orderTotal) {
          status = 'paid';
          paidCount++;
        } else if (orderPaid > 0) {
          status = 'partial';
          partialCount++;
        } else {
          status = 'unpaid';
          unpaidCount++;
        }

        custTotalInvoices += orderTotal;
        custTotalPaid += orderPaid;

        return {
          ...order,
          calculated_total: orderTotal,
          paid_amount: orderPaid,
          remaining_amount: orderRemaining,
          payment_status: status,
          payments: orderPays
        };
      });

      const custRemainingDebt = Math.max(0, custTotalInvoices - custTotalPaid);

      if (custRemainingDebt > 0) {
        customersWithDebtCount++;
      }

      grandTotalInvoices += custTotalInvoices;
      grandTotalPaid += custTotalPaid;
      grandTotalDebt += custRemainingDebt;

      const token = cust.statement_token || cust.id;
      const statementUrl = `${origin}/statement/${token}`;

      return {
        id: cust.id,
        name: cust.name,
        show_prices: cust.show_prices ?? true,
        statement_token: token,
        statement_url: statementUrl,
        created_at: cust.created_at,
        total_invoices_count: custOrders.length,
        unpaid_count: unpaidCount,
        partial_count: partialCount,
        paid_count: paidCount,
        total_invoices_amount: custTotalInvoices,
        total_paid_amount: custTotalPaid,
        total_remaining_debt: custRemainingDebt,
        orders: processedCustOrders
      };
    });

    // If single customer requested
    if (customerId) {
      const singleCust = customerSummaries.find(c => c.id === customerId);
      if (!singleCust) {
        return NextResponse.json({ error: 'الزبون غير موجود' }, { status: 404 });
      }
      return NextResponse.json({ success: true, customer: singleCust });
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_customers: customers.length,
        customers_with_debt: customersWithDebtCount,
        grand_total_debt: grandTotalDebt,
        grand_total_paid: grandTotalPaid,
        grand_total_invoices: grandTotalInvoices,
        unassigned_orders_count: unassignedOrders.length
      },
      customers: customerSummaries,
      unassigned_orders: unassignedOrders
    });
  } catch (err: any) {
    console.error('Error in admin ledger API:', err);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب بيانات دفتر الديون', details: err.message }, { status: 500 });
  }
}
