import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyCustomerSession } from '@/lib/auth/customerSession';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;


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
      const { data: settingData } = await supabaseAdmin
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

    // 2. Extract valid UUID product IDs from cart and bulk fetch from DB
    const validProductIds = cart
      .map((item: any) => item.id)
      .filter((id: any) => typeof id === 'string' && UUID_REGEX.test(id));

    const productMap = new Map<string, any>();
    if (validProductIds.length > 0) {
      const { data: prodList, error: prodErr } = await supabaseAdmin
        .from('products')
        .select('id, price, offer_type, offer_used_quantity')
        .in('id', validProductIds);

      if (prodErr) {
        console.error('Error fetching products during checkout:', prodErr);
        throw prodErr;
      }

      if (prodList) {
        prodList.forEach((prod) => productMap.set(prod.id, prod));
      }
    }

    // 3. Process cart items and map product_id accurately
    let calculatedTotalPrice = 0;
    const itemRecords: any[] = [];

    for (const item of cart) {
      const isCustomItem = item.isCustom || !item.id;
      const isValidUuid = typeof item.id === 'string' && UUID_REGEX.test(item.id);

      let actualProductId: string | null = null;
      let actualPrice = item.price || 0;

      if (isValidUuid) {
        const prodData = productMap.get(item.id);
        if (prodData) {
          actualProductId = prodData.id;
          actualPrice = prodData.price !== null && prodData.price !== undefined ? prodData.price : (item.price || 0);

          // Update offer used quantity if applicable
          if (prodData.offer_type === 'stock_limited') {
            const currentUsed = prodData.offer_used_quantity || 0;
            await supabaseAdmin
              .from('products')
              .update({ offer_used_quantity: currentUsed + item.quantity })
              .eq('id', item.id);
          }
        } else {
          // Product has a UUID format but does not exist in DB
          return NextResponse.json(
            { error: `المنتج "${item.name}" غير موجود في الكتالوج أو تم إزالته. يرجى تعديل السلة.` },
            { status: 400 }
          );
        }
      } else if (isCustomItem) {
        actualProductId = null;
      } else {
        // Invalid ID format (e.g., demo mock id 'p1') not in database
        return NextResponse.json(
          { error: `عنصر السلة "${item.name}" غير صالح. يرجى إزالته وإعادته للسلة.` },
          { status: 400 }
        );
      }

      calculatedTotalPrice += actualPrice * item.quantity;

      itemRecords.push({
        product_id: actualProductId,
        quantity: item.quantity,
        price_at_purchase: actualPrice,
        product_name: item.name,
        product_image: item.image_url || null,
        applied_offer: item.applied_offer || null
      });
    }

    // 4. Save order to database
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name: nameToSave,
        total_price: calculatedTotalPrice,
        status: 'pending'
      })
      .select('id')
      .single();

    if (orderError) {
      console.error('Error creating order record:', orderError);
      throw orderError;
    }
    const orderId = orderData.id;

    // 5. Save order items with strict error handling & cleanup
    const orderItemsToInsert = itemRecords.map((item) => ({
      ...item,
      order_id: orderId
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItemsToInsert);

    if (itemsError) {
      console.error('Error inserting order_items, cleaning up orphan order:', itemsError);
      await supabaseAdmin.from('orders').delete().eq('id', orderId);
      throw itemsError;
    }

    // 6. Construct WhatsApp message
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

    const response = NextResponse.json({
      success: true,
      orderId,
      whatsappUrl
    });

    if (auth.rehydrateToken) {
      const DURATION_180_DAYS_SEC = 180 * 24 * 60 * 60;
      response.cookies.set('customer_device_session', auth.rehydrateToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: DURATION_180_DAYS_SEC
      });
    }

    return response;
  } catch (err: any) {
    console.error('Error in store checkout API:', err);
    return NextResponse.json({ error: 'حدث خطأ أثناء معالجة الطلب' }, { status: 500 });
  }
}

