import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyCustomerSession } from '@/lib/auth/customerSession';

export async function GET(request: NextRequest) {
  try {
    // 1. Verify customer device session
    const auth = await verifyCustomerSession(request);

    if (!auth.isAllowed) {
      if (auth.status === 'pending') {
        return NextResponse.json({ error: 'الجهاز بانتظار موافقة الإدارة', redirectUrl: '/access/status?reason=pending' }, { status: 403 });
      }
      return NextResponse.json({ error: 'غير مصرح بالوصول إلى المتجر', redirectUrl: auth.redirectUrl || '/access/status?reason=unauthorized' }, { status: 401 });
    }

    // 2. Fetch categories
    const { data: categories, error: catError } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (catError) throw catError;

    // 3. Fetch products
    const { data: products, error: prodError } = await supabaseAdmin
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (prodError) throw prodError;

    // 4. Enforce Price Visibility: if showPrices is false, STRIP price completely!
    const sanitizedProducts = (products || []).map((product) => {
      if (!auth.showPrices) {
        const { price, ...rest } = product;
        return {
          ...rest,
          price: null // Explicitly nullify price field
        };
      }
      return product;
    });

    return NextResponse.json({
      categories: categories || [],
      products: sanitizedProducts,
      showPrices: auth.showPrices,
      customerName: auth.customerName || null
    });
  } catch (err: any) {
    console.error('Error in store products API:', err);
    return NextResponse.json({ error: 'حدث خطأ في جلب بيانات المتجر' }, { status: 500 });
  }
}
