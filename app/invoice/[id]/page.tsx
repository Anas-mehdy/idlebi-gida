'use client';

import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Loader2, Calendar, User, Clock, CheckCircle2, Printer, ChevronRight, Store, Gift, Tag, Download } from 'lucide-react';
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { isOfferActive, getOfferBonusQuantity, getOrderBoxSummary } from '@/lib/offerHelpers';

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  price_at_purchase: number;
  product_name?: string | null;
  product_image?: string | null;
  applied_offer?: string | null;
  products?: {
    name: string;
    image_url?: string | null;
    has_offer?: boolean;
    offer_title?: string | null;
    offer_type?: 'unlimited' | 'date_limited' | 'stock_limited';
    offer_end_date?: string | null;
    offer_max_quantity?: number | null;
    offer_used_quantity?: number;
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPDF = async () => {
    if (!order) return;
    setIsGeneratingPdf(true);
    try {
      const input = document.getElementById('customer-invoice-print-sheet');
      if (!input) {
        alert('لم يتم العثور على هيكل الفاتورة للتحميل.');
        return;
      }

      const canvas = await html2canvas(input, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.75);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      const imageAlias = `invoice-${order.id}`;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, imageAlias, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, imageAlias, 'FAST');
        heightLeft -= pageHeight;
      }

      pdf.save(`فاتورة_${order.customer_name.replace(/\s+/g, '_')}_${order.id.substring(0, 8)}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('حدث خطأ أثناء تصدير ملف PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

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
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (!data) {
        throw new Error('الفاتورة المطلوبة غير موجودة.');
      }

      const typedOrder: Order = {
        ...data,
        total_price: Number(data.total_price || 0),
        order_items: (data.order_items || []).map((item: any) => {
          const effectiveOffer = item.applied_offer || (item.products && isOfferActive(item.products) ? item.products.offer_title : null);
          return {
            ...item,
            price_at_purchase: Number(item.price_at_purchase || 0),
            applied_offer: effectiveOffer,
            product_name: item.product_name,
            product_image: item.product_image,
            products: item.products ? { ...item.products } : null
          };
        })
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
      <div id="invoice-printable-card" className="max-w-xl mx-auto bg-white border border-slate-200 shadow-md sm:rounded-3xl p-6 sm:mt-10 print:mt-0 print:border-none print:shadow-none space-y-6">
        
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
                      {(() => {
                        const offer = item.applied_offer || (item.products && isOfferActive(item.products) ? item.products.offer_title : null);
                        if (!offer) return null;
                        const bonusQty = getOfferBonusQuantity(offer, item.quantity);
                        return (
                          <div className="mt-1 inline-flex items-center gap-1 bg-amber-50 border border-amber-200/80 text-amber-900 font-bold px-2 py-0.5 rounded-lg text-[9.5px]">
                            <Gift className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>عرض خاص: {offer}</span>
                            {bonusQty > 0 && <span className="text-amber-950 font-extrabold mr-1">(+ {bonusQty} صندوق مجاناً)</span>}
                          </div>
                        );
                      })()}
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

        {/* إحصائية الصناديق للفاتورة */}
        {(() => {
          const summary = getOrderBoxSummary(order.order_items);
          return (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>إجمالي عدد الصناديق المطلوبة:</span>
              <span className="font-mono text-sm bg-slate-200/60 px-2.5 py-0.5 rounded-lg text-slate-800">
                {summary.bonusBoxes > 0 ? (
                  `${summary.totalBoxes} صندوق (${summary.paidBoxes} أصلية + ${summary.bonusBoxes} مجاناً بالعروض)`
                ) : (
                  `${summary.paidBoxes} صندوق`
                )}
              </span>
            </div>
          );
        })()}


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
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs disabled:opacity-50"
              title="تنزيل الفاتورة كملف PDF"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
              ) : (
                <Download className="w-4 h-4 text-emerald-700" />
              )}
              <span>{isGeneratingPdf ? 'جاري التنزيل...' : 'تنزيل PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>

            <Link
              href="/"
              className="bg-[#128C7E] hover:bg-[#128C7E]/90 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
              <span>الذهاب للمتجر</span>
            </Link>
          </div>
        </div>

      </div>

      {/* Official Company Invoice Sheet for PDF Export and A4 Printing */}
      <div 
        id="customer-invoice-print-sheet" 
        className="absolute left-[-9999px] top-[-9999px] w-[790px] bg-white font-sans text-right p-8 print:static print:block print:w-full print:p-0" 
        dir="rtl"
      >
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black text-slate-850">İDELBİ GIDA TİCARET LİMİTED ŞİRKETİ</h1>
              <p className="text-xs text-slate-500 font-bold mt-1">Gıda Ürünleri İthalat İhracat ve Toptan Ticareti</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Esenler, İstanbul</p>
            </div>
            <div className="text-left font-mono text-xs text-slate-500">
              <p>تاريخ الفاتورة: {new Date(order.created_at).toLocaleDateString('ar-EG', { dateStyle: 'long' })}</p>
              <p>رقم الفاتورة: #{order.id.substring(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <div className="text-center mt-4">
            <span className="text-2xl font-black border-2 border-slate-900 px-6 py-1.5 inline-block bg-slate-50 rounded-lg">فـاتـورة مـبـيـعـات</span>
          </div>
        </div>

        {/* Customer Metadata */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-sm">
          <div>
            <span className="text-slate-500 font-bold">السيد / السادة: </span>
            <span className="font-extrabold text-slate-800">{order.customer_name}</span>
          </div>
          <div className="text-left">
            <span className="text-slate-550 font-bold">حالة الدفع: </span>
            <span className="font-extrabold text-[#128C7E]">معلق / عند التسليم</span>
          </div>
        </div>

        {/* Pricing Grid */}
        <table className="w-full border-collapse border border-slate-350 text-sm">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-350">
              <th className="border border-slate-350 px-3 py-2 text-center font-black w-12">م</th>
              <th className="border border-slate-350 px-3 py-2 text-right font-black">الصنف (اسم المادة)</th>
              <th className="border border-slate-350 px-3 py-2 text-center font-black w-24">الكمية</th>
              <th className="border border-slate-350 px-3 py-2 text-center font-black w-32">السعر الإفرادي</th>
              <th className="border border-slate-350 px-3 py-2 text-center font-black w-32">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((item, idx) => {
              const price = Number(item.price_at_purchase || 0);
              const qty = item.quantity;
              const total = price * qty;
              const offer = item.applied_offer || (item.products && isOfferActive(item.products) ? item.products.offer_title : null);
              const bonusQty = offer ? getOfferBonusQuantity(offer, qty) : 0;
              return (
                <tr key={item.id} className="border-b border-slate-300">
                  <td className="border border-slate-355 px-3 py-2.5 text-center font-bold font-mono">{idx + 1}</td>
                  <td className="border border-slate-355 px-3 py-2.5 font-bold text-slate-800">
                    <div>{item.product_name || item.products?.name || 'منتج غير معروف'}</div>
                    {offer && (
                      <div className="text-[11px] text-amber-900 font-extrabold mt-1 bg-amber-50 border border-amber-200/80 rounded-md px-2 py-0.5 inline-flex items-center gap-1">
                        <span>🎁 عرض خاص: {offer}</span>
                        {bonusQty > 0 && <span className="text-amber-950 font-black">(+ {bonusQty} صندوق مجاناً)</span>}
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-355 px-3 py-2.5 text-center font-black font-mono">{qty} صندوق</td>
                  <td className="border border-slate-355 px-3 py-2.5 text-center font-extrabold font-mono">{price.toFixed(2)} TL</td>
                  <td className="border border-slate-355 px-3 py-2.5 text-center font-black font-mono">{total.toFixed(2)} TL</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Summary / Total section */}
        <div className="mt-6 border border-slate-350 rounded-xl p-4 bg-slate-50 flex justify-between items-center">
          <div className="text-xs text-slate-550 font-bold">
            <span>إجمالي الصناديق: </span>
            <span className="font-extrabold text-slate-800 text-sm font-mono mr-1">
              {(() => {
                const summary = getOrderBoxSummary(order.order_items);
                return summary.bonusBoxes > 0 ? (
                  `${summary.totalBoxes} صندوق (${summary.paidBoxes} أصلية + ${summary.bonusBoxes} مجاناً بالعروض)`
                ) : (
                  `${summary.paidBoxes} صندوق`
                );
              })()}
            </span>
          </div>

          <div className="text-right">
            <span className="text-slate-700 font-black text-md">المجموع الكلي النهائي:</span>
            <span className="text-xl font-black text-[#128C7E] font-mono mr-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
              {Number(order.total_price).toFixed(2)} TL
            </span>
          </div>
        </div>

        {/* Signature / Notes */}
        <div className="grid grid-cols-2 gap-4 mt-16 text-center text-xs">
          <div>
            <p className="text-slate-400 font-bold mb-8">توقيع المستلم</p>
            <div className="border-b border-slate-300 w-40 mx-auto"></div>
          </div>
          <div>
            <p className="text-slate-400 font-bold mb-8">خاتم وتوقيع الشركة</p>
            <div className="border-b border-slate-300 w-40 mx-auto"></div>
          </div>
        </div>

        <div className="mt-16 text-center text-[10px] text-slate-400 border-t border-slate-200 pt-4 font-bold">
          * شكراً لتعاملكم معنا • تمنياتنا لكم بالرزق والتوفيق • İDELBİ GIDA
        </div>
      </div>
    </div>
  );
}
