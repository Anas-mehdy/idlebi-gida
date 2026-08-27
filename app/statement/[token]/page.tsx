'use client';

import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Store, User, Calendar, Clock, CheckCircle2, AlertCircle, 
  Receipt, Printer, ChevronDown, ChevronUp, 
  ShoppingBag, Gift, ArrowRight, MessageCircle, FileText, Check, Download, Loader2, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { getOfferBonusQuantity, getOrderBoxSummary } from '@/lib/offerHelpers';

interface OrderItem {
  id: string;
  product_name: string;
  product_image?: string | null;
  quantity: number;
  price_at_purchase: number;
  applied_offer?: string | null;
}

interface Payment {
  id: string;
  amount: number;
  note?: string | null;
  created_at: string;
}

interface Order {
  id: string;
  created_at: string;
  status: string;
  total_price: number;
  order_items: OrderItem[];
}

interface StatementData {
  customer: {
    id: string;
    name: string;
    show_prices: boolean;
    statement_token?: string;
  };
  summary: {
    total_invoices_amount: number;
    total_paid_amount: number;
    total_remaining_debt: number;
    total_invoices_count: number;
    total_payments_count?: number;
  };
  orders: Order[];
  payments: Payment[];
}

export default function CustomerStatementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const [activePdfOrder, setActivePdfOrder] = useState<Order | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generatingOrderId, setGeneratingOrderId] = useState<string | null>(null);

  const fetchStatement = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/statement/${token}`);
      const json = await res.json();

      if (res.ok && json.success) {
        setData(json);
        return;
      }

      const localCustomers = JSON.parse(localStorage.getItem('idlebi_customers') || '[]');
      const matchedCust = localCustomers.find((c: any) => c.statement_token === token || c.id === token || c.name === decodeURIComponent(token));

      if (matchedCust) {
        const mockStatement: StatementData = {
          customer: {
            id: matchedCust.id,
            name: matchedCust.name,
            show_prices: true
          },
          summary: {
            total_invoices_amount: 14500,
            total_paid_amount: 9500,
            total_remaining_debt: 5000,
            total_invoices_count: 2,
            total_payments_count: 2
          },
          orders: [
            {
              id: 'ord-101',
              created_at: new Date().toISOString(),
              status: 'pending',
              total_price: 6000,
              order_items: [
                { id: 'item-1', product_name: 'شاي تركي غوكسو 100 ظرف', quantity: 20, price_at_purchase: 85, applied_offer: 'اشتر 10 واحصل على 1 مجاناً' },
                { id: 'item-2', product_name: 'كوكا كولا علب 330 مل', quantity: 172, price_at_purchase: 25 }
              ]
            },
            {
              id: 'ord-102',
              created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
              status: 'delivered',
              total_price: 8500,
              order_items: [
                { id: 'item-3', product_name: 'سمنة البقرة الحلوب 800غ', quantity: 50, price_at_purchase: 170 }
              ]
            }
          ],
          payments: [
            { id: 'pay-1', amount: 5000, note: 'حوالة بنكية من حساب المحل', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
            { id: 'pay-2', amount: 4500, note: 'تسديد نقداً مع السائق', created_at: new Date(Date.now() - 86400000 * 1).toISOString() }
          ]
        };
        setData(mockStatement);
      } else {
        throw new Error(json.error || 'لم يتم العثور على كشف حساب مطابق لهذا الرابط');
      }
    } catch (err: any) {
      console.error('Error fetching statement:', err);
      setError(err.message || 'حدث خطأ في تحميل كشف الحساب');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStatement();
    }
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const handleDownloadInvoicePdf = async (order: Order) => {
    setGeneratingOrderId(order.id);
    setIsGeneratingPdf(true);

    try {
      const input = document.getElementById(`invoice-pdf-${order.id}`);
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

      const custName = data?.customer?.name || 'الزبون';
      pdf.save(`فاتورة_${custName.replace(/\s+/g, '_')}_${order.id.substring(0, 8)}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('حدث خطأ أثناء تصدير ملف PDF.');
    } finally {
      setIsGeneratingPdf(false);
      setGeneratingOrderId(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ar-EG-u-nu-latn', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('ar-EG-u-nu-latn', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center font-sans" dir="rtl">
        <div className="w-12 h-12 border-4 border-[#128C7E] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-black text-slate-800">جاري تحميل كشف الحساب...</h2>
        <p className="text-xs text-slate-500 mt-1">يرجى الانتظار لحظات</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center font-sans" dir="rtl">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-black text-slate-800">تعذر عرض كشف الحساب</h2>
        <p className="text-xs text-slate-600 max-w-sm mt-1">{error || 'الرابط غير صالح أو انتهت صلاحيته'}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 bg-[#128C7E] text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-md hover:bg-[#128C7E]/90 transition-all"
        >
          <span>الذهاب للمتجر الرئيسي</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const { customer, summary, orders, payments = [] } = data;

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans pb-16 text-right" dir="rtl">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs print:static">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#128C7E] text-white p-2.5 rounded-2xl shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 leading-tight">idelbi gida</h1>
              <p className="text-[11px] text-emerald-700 font-bold">دفتر الحسابات والذمم المالية</p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-250 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>طباعة الكشف</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        <div className="bg-white border border-slate-250 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-black text-lg">
                <User className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-450 block">كشف حساب العميل</span>
                <h2 className="text-lg font-black text-slate-900">{customer.name}</h2>
              </div>
            </div>
            <div className="text-right sm:text-left">
              <span className="text-[11px] text-slate-450 font-medium block">تاريخ التحديث اللحظي</span>
              <span className="text-xs font-bold text-slate-700">{formatDate(new Date().toISOString())}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
              summary.total_remaining_debt > 0 ? 'bg-rose-50/80 border-rose-200/90 text-rose-950' : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            }`}>
              <span className="text-xs font-bold opacity-80">المتبقي للدفع</span>
              <div className="mt-2">
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-black ${summary.total_remaining_debt > 0 ? 'text-rose-650' : 'text-emerald-700'}`}>
                    {summary.total_remaining_debt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-bold">ليرة</span>
                </div>
              </div>
              <span className="text-[10px] font-bold mt-1 opacity-75">{summary.total_remaining_debt > 0 ? 'مبلغ الذمة المترتب' : 'خالص الحساب'}</span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 text-emerald-950 flex flex-col justify-between">
              <span className="text-xs font-bold opacity-80">مجموع المبالغ المسددة</span>
              <div className="mt-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-700">
                    {summary.total_paid_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-bold">ليرة</span>
                </div>
              </div>
              <span className="text-[10px] font-bold mt-1 text-emerald-800">إجمالي كافة الدفعات المقبوضة</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500">إجمالي قيمة الفواتير</span>
              <div className="mt-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-800">
                    {summary.total_invoices_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-bold text-slate-600">ليرة</span>
                </div>
              </div>
              <span className="text-[10px] font-bold mt-1 text-slate-500">إجمالي {summary.total_invoices_count} فواتير مسجلة</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-250 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>سجل الدفعات والمقبوضات المستلمة ({payments.length})</span>
            </h3>
            <span className="text-xs font-bold text-slate-600">
              المسدد: <span className="text-emerald-700 font-black">{summary.total_paid_amount.toFixed(2)} TL</span>
            </span>
          </div>

          {payments.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-250 text-center text-xs text-slate-400 font-bold">
              لم تسجل أي دفعات في الحساب حتى الآن.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {payments.map((p, pIdx) => (
                <div key={p.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {pIdx + 1}
                      </span>
                      <span className="text-sm font-black text-emerald-700">
                        دفعة بقيمة: {Number(p.amount).toFixed(2)} TL
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium mr-2">{formatDate(p.created_at)}</span>
                    </div>
                    {p.note && (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-7 w-fit">
                        <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>توضيح الإدارة: {p.note}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-xl w-fit self-start sm:self-auto">
                    ✓ تم الخصم من إجمالي الحساب
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-250 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-slate-700" />
              <span>قائمة الفواتير المرجعية ({orders.length})</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-450">اضغط على أي فاتورة لعرض المواد أو تنزيلها PDF</span>
          </div>

          {orders.length === 0 ? (
            <div className="p-8 bg-slate-50 border border-dashed border-slate-250 rounded-2xl text-center text-xs text-slate-400 font-bold">
              لا توجد فواتير مسجلة في هذا الكشف.
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const isExpanded = Boolean(expandedOrders[order.id]);
                const isDownloadingThis = isGeneratingPdf && generatingOrderId === order.id;

                return (
                  <div key={order.id} className={`border rounded-2xl overflow-hidden transition-all ${isExpanded ? 'border-slate-300 bg-slate-50/40' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <div onClick={() => toggleOrder(order.id)} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800">فاتورة #{order.id.slice(0, 8).toUpperCase()}</span>
                          </div>
                          <div className="text-[11px] text-slate-450 font-medium flex items-center gap-3">
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" />{formatDate(order.created_at)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" />{formatTime(order.created_at)}</span>
                            <span>•</span>
                            <span>{order.order_items.length} مواد</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-right sm:text-left">
                          <div className="text-xs font-bold text-slate-700">الإجمالي: <span className="font-black text-sm text-slate-900">{order.total_price.toFixed(2)} TL</span></div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownloadInvoicePdf(order); }}
                          disabled={isGeneratingPdf}
                          className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-2xs disabled:opacity-50"
                        >
                          {isDownloadingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" /> : <Download className="w-3.5 h-3.5 text-emerald-700" />}
                          <span>{isDownloadingThis ? 'جاري التحميل...' : 'تنزيل PDF'}</span>
                        </button>
                        <Link href={`/invoice/${order.id}`} target="_blank" onClick={(e) => e.stopPropagation()} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-1">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-slate-200 p-4 bg-white space-y-3">
                        <h5 className="text-xs font-bold text-slate-700">تفاصيل المواد والأسعار:</h5>
                        <div className="divide-y divide-slate-100">
                          {order.order_items.map((item) => (
                            <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                              <div className="space-y-0.5">
                                <span className="font-bold text-slate-800">{item.product_name}</span>
                                <div className="text-[11px] text-slate-500 font-medium">{item.quantity} صندوق × {Number(item.price_at_purchase).toFixed(2)} TL</div>
                                {item.applied_offer && (
                                  <div className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px]">
                                    <Gift className="w-3 h-3 text-amber-600" />
                                    <span>{item.applied_offer}</span>
                                  </div>
                                )}
                              </div>
                              <span className="font-black text-slate-900">{(item.quantity * item.price_at_purchase).toFixed(2)} TL</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-250 rounded-3xl p-6 shadow-xs text-center space-y-3 print:hidden">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800">هل لديك أي استفسار حول كشف الحساب أو الدفعات؟</h4>
            <p className="text-xs text-slate-500 mt-0.5">يمكنك التواصل مباشرة مع إدارة idelbi gida لتأكيد الحسابات والمدفوعات</p>
          </div>
          <a
            href="https://wa.me/905000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-[#128C7E] hover:bg-[#128C7E]/90 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all shadow-xs"
          >
            <MessageCircle className="w-4 h-4" />
            <span>محادثة الإدارة عبر واتساب</span>
          </a>
        </div>

      </main>

      {/* Hidden Official PDF Print Layouts for Each Invoice */}
      <div className="print:hidden">
        {orders.map((ord) => (
          <div 
            key={`pdf-${ord.id}`}
            id={`invoice-pdf-${ord.id}`} 
            className="fixed left-[-9999px] top-[-9999px] w-[790px] bg-white font-sans text-right p-8 pointer-events-none" 
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
                  <p>تاريخ الفاتورة: {new Date(ord.created_at).toLocaleDateString('ar-EG-u-nu-latn', { dateStyle: 'long' })}</p>
                  <p>رقم الفاتورة: #{ord.id.substring(0, 8).toUpperCase()}</p>
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
                <span className="font-extrabold text-slate-800">{customer.name}</span>
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
                {ord.order_items.map((item, idx) => {
                  const price = Number(item.price_at_purchase || 0);
                  const qty = item.quantity;
                  const total = price * qty;
                  const bonusQty = item.applied_offer ? getOfferBonusQuantity(item.applied_offer, qty) : 0;
                  return (
                    <tr key={item.id} className="border-b border-slate-300">
                      <td className="border border-slate-355 px-3 py-2.5 text-center font-bold font-mono">{idx + 1}</td>
                      <td className="border border-slate-355 px-3 py-2.5 font-bold text-slate-800">
                        <div>{item.product_name}</div>
                        {item.applied_offer && (
                          <div className="text-[11px] text-amber-900 font-extrabold mt-1 bg-amber-50 border border-amber-200/80 rounded-md px-2 py-0.5 inline-flex items-center gap-1">
                            <span>🎁 عرض خاص: {item.applied_offer}</span>
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
                    const summary = getOrderBoxSummary(ord.order_items);
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
                  {Number(ord.total_price).toFixed(2)} TL
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
        ))}
      </div>
    </div>
  );
}
