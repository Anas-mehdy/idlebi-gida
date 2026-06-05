'use client';

import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Loader2, Calendar, User, Clock, CheckCircle2, Printer, ChevronRight, Store } from 'lucide-react';
import Link from 'next/link';

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  price_at_purchase: number;
  product_name?: string | null;
  product_image?: string | null;
  products?: {
    name: string;
    image_url?: string | null;
  } | null;
}

interface Order {
  id: string;
  customer_name: string;
  total_price: number;
  status: string;
  created_at: string;
  order_items: OrderItem[];
}

export default function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      setError(null);

      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      if (!isUrlConfigured) {
        throw new Error('قاعدة البيانات غير متصلة حالياً (بيئة تجريبية).');
      }

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product_name,
            product_image,
            products (
              name,
              image_url
            )
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (!data) {
        throw new Error('الفاتورة المطلوبة غير موجودة.');
      }

      const typedOrder: Order = {
        ...data,
        order_items: (data.order_items || []).map((item: any) => ({
          ...item,
          product_name: item.product_name,
          product_image: item.product_image,
          products: item.products ? { name: item.products.name, image_url: item.products.image_url } : null
        }))
      };

      setOrder(typedOrder);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ أثناء تحميل الفاتورة. يرجى محاولة فتح الرابط مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
        <h2 className="text-sm font-bold text-slate-700">جاري تحميل الفاتورة وتفاصيل الأسعار...</h2>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="bg-rose-50 p-4 rounded-full text-rose-500 w-16 h-16 flex items-center justify-center shadow-inner">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h1 className="text-md font-extrabold text-slate-800">خطأ في تحميل الفاتورة</h1>
          <p className="text-xs text-slate-500 max-w-xs">{error || 'لم نتمكن من العثور على الفاتورة المطلوبة.'}</p>
        </div>
        <Link
          href="/"
          className="bg-[#075E54] hover:bg-[#128C7E] text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-colors shadow-sm"
        >
          الذهاب للمتجر الرئيسي
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10 font-sans text-right" dir="rtl">
      {/* Printable Invoice Container */}
      <div className="max-w-xl mx-auto bg-white border border-slate-200 shadow-md sm:rounded-3xl p-6 sm:mt-10 print:mt-0 print:border-none print:shadow-none space-y-6">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="bg-[#128C7E] p-2.5 rounded-2xl text-white shadow-inner flex items-center justify-center">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800">idelbi gida</h1>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5">تجارة المواد الغذائية بالجملة • idelbi gıda</p>
            </div>
          </div>
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>فاتورة مسعّرة</span>
          </span>
        </div>

        {/* Invoice Metadata Grid */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-600">
              <User className="w-4 h-4 text-slate-400" />
              <span className="font-bold">الزبون:</span>
              <span className="text-slate-800 font-semibold">{order.customer_name}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="font-bold">التاريخ:</span>
              <span className="text-slate-800 font-semibold">{formatDate(order.created_at)}</span>
            </div>
          </div>
          <div className="space-y-2 sm:text-left sm:flex sm:flex-col sm:items-end">
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="font-bold">ساعة الطلب:</span>
              <span className="text-slate-800 font-semibold">{formatTime(order.created_at)}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-bold">رقم الفاتورة:</span>
              <span className="font-mono text-slate-800 font-bold">{order.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Invoice Items Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">تفاصيل المواد والأسعار</h3>
          <div className="divide-y divide-slate-100">
            {order.order_items.map((item) => {
              const itemTotalPrice = (item.price_at_purchase || 0) * item.quantity;
              return (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Image Thumbnail */}
                    <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                      {item.product_image || item.products?.image_url ? (
                        <img
                          src={item.product_image || item.products?.image_url || undefined}
                          alt={item.product_name || item.products?.name || ''}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-slate-350" />
                      )}
                    </div>
                    {/* Item details */}
                    <div className="min-w-0 flex-1 text-right">
                      <p className="text-sm font-bold text-slate-800 truncate">{item.product_name || item.products?.name || 'منتج غير متوفر'}</p>
                      <p className="text-[10px] text-slate-450 font-semibold mt-0.5">
                        {item.price_at_purchase > 0 ? (
                          `${item.quantity} صندوق × ${Number(item.price_at_purchase).toFixed(2)} TL`
                        ) : (
                          `${item.quantity} صندوق × يحدد لاحقاً`
                        )}
                      </p>
                    </div>
                  </div>
                  {/* Total Price for item */}
                  <span className="text-sm font-black text-slate-800 whitespace-nowrap">
                    {item.price_at_purchase > 0 ? (
                      `${itemTotalPrice.toFixed(2)} TL`
                    ) : (
                      <span className="text-[10px] text-slate-400">يحدد لاحقاً</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grand Total Card */}
        <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block">إجمالي الفاتورة النهائي</span>
            <span className="text-[10px] text-emerald-650 font-bold block mt-0.5">* شامل كافة المواد الغذائية أعلاه</span>
          </div>
          <span className="text-xl font-black text-emerald-600">
            {Number(order.total_price).toFixed(2)} TL
          </span>
        </div>

        {/* Footer info & Printable Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-5 border-t border-slate-200 text-center sm:text-right print:hidden">
          <p className="text-[10px] text-slate-400 font-bold">شكراً لتعاملكم معنا • idelbi gıda</p>
          <div className="flex items-center justify-center gap-2.5">
            <button
              onClick={handlePrint}
              className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الفاتورة</span>
            </button>
            <Link
              href="/"
              className="bg-emerald-650 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
              style={{ backgroundColor: '#128C7E' }}
            >
              <ChevronRight className="w-4 h-4" />
              <span>الذهاب للمتجر</span>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
