'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { ChevronRight, MessageSquare, User, FileText, ShoppingCart, Trash2, ArrowRight } from 'lucide-react';

export default function CheckoutPage() {
  const { cart, totalPrice, totalQuantity, clearCart, removeFromCart, addToCart } = useCart();
  const router = useRouter();
  const [customerName, setCustomerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('905000000000'); // Seed fallback
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch active WhatsApp number from settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
        if (!isUrlConfigured) return;

        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'whatsapp_number')
          .single();

        if (data && data.value) {
          setWhatsappNumber(data.value);
        }
      } catch (err) {
        console.warn('Could not fetch WhatsApp number from database, using seed fallback.', err);
      }
    }
    fetchSettings();
  }, []);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMsg('يرجى إدخال اسم الزبون لتأكيد الطلب.');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      let orderId = '';
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

      if (isUrlConfigured) {
        // 1. Save order to orders table
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            customer_name: customerName.trim(),
            total_price: totalPrice,
            status: 'pending'
          })
          .select('id')
          .single();

        if (orderError) throw orderError;
        orderId = orderData.id;

        // 2. Save items to order_items table
        const orderItemsToInsert = cart.map((item) => ({
          order_id: orderId,
          product_id: item.id.startsWith('p') ? null : item.id, // Set null if using mock ids (p1, p2)
          quantity: item.quantity,
          price_at_purchase: item.price
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItemsToInsert);

        if (itemsError) throw itemsError;
      } else {
        console.log('Database not connected. Bypassing database save in demo mode.');
      }

      // 3. Build WhatsApp text structure exactly as requested
      // طلب جديد: idelbi gida
      // 1. [Product Name] (x[Qty])
      // [Price] TL
      // -----------------------
      // الحساب: [Total] TL
      // الزبون: [Customer Name]
      
      const hasUnpricedItems = cart.some(item => !item.price || Number(item.price) === 0);
      let messageLines = ['طلب جديد: idelbi gida'];
      cart.forEach((item, index) => {
        messageLines.push(`${index + 1}. ${item.name} (x${item.quantity})`);
        if (item.price !== null && item.price !== undefined && Number(item.price) > 0) {
          messageLines.push(`${(item.price * item.quantity).toFixed(2)} TL`);
        } else {
          messageLines.push('السعر يحدد لاحقاً عند الطلب');
        }
      });
      messageLines.push('-----------------------');
      messageLines.push(`الحساب: ${totalPrice.toFixed(2)} TL`);
      if (hasUnpricedItems) {
        messageLines.push('*(يوجد مواد يحدد سعرها عند الطلب)*');
      }
      messageLines.push(`الزبون: ${customerName.trim()}`);

      const encodedText = encodeURIComponent(messageLines.join('\n'));
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedText}`;

      // Clear the local shopping cart
      clearCart();

      // Redirect user to WhatsApp
      window.location.href = whatsappUrl;
    } catch (err: any) {
      console.error('Checkout process encountered an error, falling back silently and instantly to WhatsApp:', err);
      
      // Fallback redirection to WhatsApp silently and instantly even if DB fails
      const hasUnpricedItems = cart.some(item => !item.price || Number(item.price) === 0);
      let messageLines = ['طلب جديد: idelbi gida'];
      cart.forEach((item, index) => {
        messageLines.push(`${index + 1}. ${item.name} (x${item.quantity})`);
        if (item.price !== null && item.price !== undefined && Number(item.price) > 0) {
          messageLines.push(`${(item.price * item.quantity).toFixed(2)} TL`);
        } else {
          messageLines.push('السعر يحدد لاحقاً عند الطلب');
        }
      });
      messageLines.push('-----------------------');
      messageLines.push(`الحساب: ${totalPrice.toFixed(2)} TL`);
      if (hasUnpricedItems) {
        messageLines.push('*(يوجد مواد يحدد سعرها عند الطلب)*');
      }
      messageLines.push(`الزبون: ${customerName.trim()}`);

      const encodedText = encodeURIComponent(messageLines.join('\n'));
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedText}`;
      
      clearCart();
      window.location.href = whatsappUrl;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 min-h-screen font-sans text-center">
        <div className="max-w-md mx-auto space-y-6">
          <div className="bg-teal-50 p-4 rounded-full text-[#128C7E] w-20 h-20 flex items-center justify-center mx-auto shadow-inner">
            <ShoppingCart className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-slate-800">سلتك فارغة حالياً</h1>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">تصفح كتالوج المنتجات وقم بإضافة المواد التي تحتاجها لإصدار الفاتورة.</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[#075E54] hover:bg-[#128C7E] text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-md active:scale-95"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للكتالوج</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-[#075E54] text-white px-4 py-4 shadow-md z-40 shrink-0">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Link href="/" className="hover:bg-[#128C7E] p-2 rounded-xl text-white transition-colors">
            <ChevronRight className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">عرض فاتورتك</h1>
            <p className="text-xs text-teal-100 font-medium">مراجعة المنتجات وتأكيد الطلب</p>
          </div>
        </div>
      </header>

      {/* Main Form content */}
      <main className="flex-1 px-4 py-5 overflow-y-auto">
        <div className="max-w-md mx-auto space-y-5">
          {/* Summary Invoice Header Card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3.5 border-b border-slate-100">
              <FileText className="w-5 h-5 text-teal-600" />
              <h2 className="text-sm font-bold text-slate-800">تفاصيل الفاتورة</h2>
            </div>

            {/* List of items */}
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto no-scrollbar">
              {cart.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate text-right">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 text-right">
                      {item.price !== null && item.price !== undefined && Number(item.price) > 0 ? (
                        `${item.quantity} × ${Number(item.price).toFixed(2)} TL`
                      ) : (
                        `${item.quantity} × السعر يحدد لاحقاً عند الطلب`
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-800">
                      {item.price !== null && item.price !== undefined && Number(item.price) > 0 ? (
                        `${(Number(item.price) * item.quantity).toFixed(2)} TL`
                      ) : (
                        'يحدد عند الطلب'
                      )}
                    </span>
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/50">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="bg-white hover:bg-slate-200 text-slate-600 p-1 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Row */}
            <div className="pt-3.5 border-t border-dashed border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">إجمالي الفاتورة:</span>
              <span className="text-lg font-black text-[#128C7E] flex flex-col items-end">
                <span>{totalPrice.toFixed(2)} TL</span>
                {cart.some(item => !item.price || Number(item.price) === 0) && (
                  <span className="text-[10px] text-slate-400 font-bold block mt-0.5">*(يوجد مواد يحدد سعرها عند الطلب)*</span>
                )}
              </span>
            </div>
          </div>

          {/* Customer Form */}
          <form onSubmit={handleCheckout} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2">
              <User className="w-5 h-5 text-teal-600" />
              <h2 className="text-sm font-bold text-slate-800">معلومات المشتري</h2>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="customerName" className="block text-xs font-bold text-slate-500 text-right">
                اسم الزبون <span className="text-rose-500">*</span>
              </label>
              <input
                id="customerName"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="اكتب اسم المحل أو اسمك الشخصي هنا..."
                className="w-full bg-slate-50 border border-slate-200 outline-none rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all text-right"
                disabled={isSubmitting}
                required
              />
              <p className="text-[10px] text-slate-400 text-right">
                يرجى كتابة الاسم المعتمد لسهولة التعرف على طلبك وتجهيزه.
              </p>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 p-3 rounded-xl text-xs text-right font-medium">
                {errorMsg}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#25D366] hover:bg-[#20ba59] disabled:bg-slate-300 text-white rounded-xl py-3.5 px-4 font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.98] pointer-events-auto"
            >
              <MessageSquare className="w-4.5 h-4.5" />
              <span>{isSubmitting ? 'جاري تجهيز الفاتورة...' : 'إرسال الفاتورة عبر واتساب'}</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
