import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyCustomerSession } from '@/lib/auth/customerSession';

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyCustomerSession(request);

    if (!auth.isAllowed) {
      return NextResponse.json({ error: 'غير مصرح بإجراء الطلب' }, { status: 401 });
    }

    const { cart, customerName } = await request.json();

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: 'السلة فارغة' }, { status: 400 });
    }

    const nameToSave = customerName || auth.customerName || 'زبون معتمد';

    // 1. Get WhatsApp number from settings
    let whatsappNumber = '905000000000';
    try {
      const { data: settingData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'whatsapp_number')
        .single();
      if (settingData?.value) {
        whatsappNumber = settingData.value;
      }
    } catch (err) {
      console.warn('Could not fetch whatsapp number setting:', err);
    }

    // 2. Fetch actual product prices from database for accurate internal order records
    let calculatedTotalPrice = 0;
    const itemRecords: any[] = [];

    for (const item of cart) {
      let actualPrice = item.price || 0;

      if (item.id && !item.id.startsWith('p')) {
        const { data: prodData } = await supabase
          .from('products')
          .select('price, offer_type, offer_used_quantity')
          .eq('id', item.id)
          .single();

        if (prodData) {
          actualPrice = prodData.price || 0;
          // Update offer used quantity if applicable
          if (prodData.offer_type === 'stock_limited') {
            const currentUsed = prodData.offer_used_quantity || 0;
            await supabase
              .from('products')
              .update({ offer_used_quantity: currentUsed + item.quantity })
              .eq('id', item.id);
          }
        }
      }

      calculatedTotalPrice += actualPrice * item.quantity;

      itemRecords.push({
        product_id: item.id && !item.id.startsWith('p') ? item.id : null,
        quantity: item.quantity,
        price_at_purchase: actualPrice,
        product_name: item.name,
        product_image: item.image_url,
        applied_offer: item.applied_offer || null
      });
    }

    // 3. Save order to database
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: nameToSave,
        total_price: calculatedTotalPrice,
        status: 'pending'
      })
      .select('id')
      .single();

    if (orderError) throw orderError;
    const orderId = orderData.id;

    // Save order items
    const orderItemsToInsert = itemRecords.map((item) => ({
      ...item,
      order_id: orderId
    }));

    await supabase.from('order_items').insert(orderItemsToInsert);

    // 4. Construct WhatsApp message
    let messageLines = ['طلب جديد: idelbi gida'];
    cart.forEach((item: any, index: number) => {
      let line = `${index + 1}. ${item.name} (x${item.quantity})`;
      if (item.applied_offer) {
        line += ` [🎁 عرض: ${item.applied_offer}]`;
      }
      messageLines.push(line);

      // Only include price per item if showPrices is true!
      if (auth.showPrices && item.price !== null && item.price !== undefined && Number(item.price) > 0) {
        messageLines.push(`${(item.price * item.quantity).toFixed(2)} TL`);
      }
    });

    messageLines.push('-----------------------');
    if (auth.showPrices) {
      messageLines.push(`الحساب: ${calculatedTotalPrice.toFixed(2)} TL`);
    } else {
      messageLines.push('ملاحظة: سيتم تأكيد الأسعار معكم عبر واتساب.');
    }
    messageLines.push(`الزبون: ${nameToSave}`);

    const encodedText = encodeURIComponent(messageLines.join('\n'));
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedText}`;

    return NextResponse.json({
      success: true,
      orderId,
      whatsappUrl
    });
  } catch (err: any) {
    console.error('Error in store checkout API:', err);
    return NextResponse.json({ error: 'حدث خطأ أثناء معالجة الطلب' }, { status: 500 });
  }
}
