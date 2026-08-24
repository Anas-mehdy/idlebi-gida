'use client';

import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Store, User, Calendar, Clock, CheckCircle2, AlertCircle, 
  Hourglass, Receipt, Printer, ChevronDown, ChevronUp, 
  ShoppingBag, Gift, ArrowRight, Phone, MessageCircle, FileText, Check
} from 'lucide-react';
import Link from 'next/link';

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
  paid_amount: number;
  remaining_amount: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  payments: Payment[];
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
    unpaid_count: number;
    partial_count: number;
    paid_count: number;
    total_invoices_count: number;
  };
  orders: Order[];
}

export default function CustomerStatementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const fetchStatement = async () => {
    try {
      setLoading(true);
      setError(null);

      // Attempt fetch via API
      const res = await fetch(`/api/statement/${token}`);
      const json = await res.json();

      if (res.ok && json.success) {
        setData(json);
        // Automatically expand the latest invoice
        if (json.orders && json.orders.length > 0) {
          setExpandedOrders({ [json.orders[0].id]: true });
        }
        return;
      }

      // If API error or DB not connected, fallback to local/mock generator for demo preview
      const localCustomers = JSON.parse(localStorage.getItem('idlebi_customers') || '[]');
      const matchedCust = localCustomers.find((c: any) => c.statement_token === token || c.id === token || c.name === decodeURIComponent(token));

      if (matchedCust) {
        const mockStatement: StatementData = {
          customer: {
            id: matchedCust.id,
            name: matchedCust.name,
            show_prices: matchedCust.show_prices ?? true
          },
          summary: {
            total_invoices_amount: 14500,
            total_paid_amount: 9500,
            total_remaining_debt: 5000,
            unpaid_count: 1,
            partial_count: 1,
            paid_count: 1,
            total_invoices_count: 3
          },
          orders: [
            {
              id: 'ord-101',
              created_at: new Date().toISOString(),
              status: 'pending',
              total_price: 6000,
              paid_amount: 2000,
              remaining_amount: 4000,
              payment_status: 'partial',
              payments: [
                {
                  id: 'pay-1',
                  amount: 2000,
                  note: 'دفعة أولى نقداً عند التسليم',
                  created_at: new Date().toISOString()
                }
              ],
              order_items: [
                { id: 'item-1', product_name: 'شاي تركي غوكسو 100 ظرف', quantity: 20, price_at_purchase: 85, applied_offer: 'اشتر 10 واحصل على 1 مجاناً' },
                { id: 'item-2', product_name: 'كوكا كولا علب 330 مل', quantity: 172, price_at_purchase: 25 }
              ]
            },
            {
              id: 'ord-102',
              created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
              status: 'delivered',
              total_price: 1000,
              paid_amount: 0,
              remaining_amount: 1000,
              payment_status: 'unpaid',
              payments: [],
              order_items: [
                { id: 'item-3', product_name: 'بسكويت شوكولاتة أولكر 12 قطعة', quantity: 20, price_at_purchase: 50 }
              ]
            },
            {
              id: 'ord-103',
              created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
              status: 'delivered',
              total_price: 7500,
              paid_amount: 7500,
              remaining_amount: 0,
              payment_status: 'paid',
              payments: [
                { id: 'pay-2', amount: 5000, note: 'حوالة بنكية من حساب المحل', created_at: new Date(Date.now() - 86400000 * 6).toISOString() },
                { id: 'pay-3', amount: 2500, note: 'تسديد الباقي كاش مع السائق', created_at: new Date(Date.now() - 86400000 * 5).toISOString() }
              ],
              order_items: [
                { id: 'item-4', product_name: 'صلصة طماطم تات 800 غ', quantity: 50, price_at_purchase: 55 },
                { id: 'item-5', product_name: 'أرز تركي بالدو 1 كغ', quantity: 68, price_at_purchase: 70 }
              ]
            }
          ]
        };
        setData(mockStatement);
        setExpandedOrders({ 'ord-101': true });
      } else {
        throw new Error(json.error || 'لم نتمكن من العثور على كشف الحساب المطلوب.');
      }
    } catch (err: any) {
      console.error('Error fetching statement:', err);
      setError(err.message || 'حدث خطأ في تحميل كشف الحساب.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStatement();
    }
  }, [token]);

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-base font-bold text-slate-800">جاري تحميل كشف الحساب...</h2>
        <p className="text-xs text-slate-500 mt-1">يتم تحديث الفواتير والدفعات لحظياً</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans space-y-4" dir="rtl">
        <div className="bg-rose-50 p-4 rounded-full text-rose-500 w-16 h-16 flex items-center justify-center mx-auto shadow-inner">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-lg font-bold text-slate-800">كشف الحساب غير متوفر</h1>
        <p className="text-xs text-slate-500 max-w-sm">{error || 'الرابط غير صالح أو تم تغييره من قبل الإدارة.'}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-[#128C7E] hover:bg-[#128C7E]/90 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-sm transition-all"
        >
          <Store className="w-4 h-4" />
          <span>الذهاب للمتجر الرئيسي</span>
        </Link>
      </div>
    );
  }

  const { customer, summary, orders } = data;
  const showPrices = customer.show_prices;

  // Filter orders based on active tab
  const filteredOrders = orders.filter(order => {
    if (activeTab === 'unpaid') return order.payment_status === 'unpaid';
    if (activeTab === 'partial') return order.payment_status === 'partial';
    if (activeTab === 'paid') return order.payment_status === 'paid';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100/70 pb-16 font-sans text-right" dir="rtl">
      
      {/* Top Header Bar */}
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
              title="طباعة كشف الحساب"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">طباعة الكشف</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-5">
        
        {/* Customer Welcome & Identity Card */}
        <div className="bg-white border border-slate-250 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
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

          {/* Simple, Large, High-Contrast Summary Numbers for non-tech users */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            
            {/* 1. Remaining Debt (المتبقي الكلي) */}
            <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
              summary.total_remaining_debt > 0 
                ? 'bg-rose-50/80 border-rose-200/90 text-rose-950' 
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            }`}>
              <span className="text-xs font-bold opacity-80">المتبقي للدفع (الذمة الحالية)</span>
              <div className="mt-2">
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-black ${
                    summary.total_remaining_debt > 0 ? 'text-rose-650' : 'text-emerald-700'
                  }`}>
                    {summary.total_remaining_debt.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-bold">ليرة</span>
                </div>
              </div>
              <span className="text-[10px] font-bold mt-1 opacity-75">
                {summary.total_remaining_debt > 0 ? 'مبلغ الذمة المترتب حتى الآن' : 'خالص الحساب تماماً 🎉'}
              </span>
            </div>

            {/* 2. Total Paid (مجموع ما تم تسديده) */}
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 text-emerald-950 flex flex-col justify-between">
              <span className="text-xs font-bold opacity-80">مجموع المبالغ المسددة</span>
              <div className="mt-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-700">
                    {summary.total_paid_amount.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-bold">ليرة</span>
                </div>
              </div>
              <span className="text-[10px] font-bold mt-1 text-emerald-800">إجمالي الدفعات المقبوضة</span>
            </div>

            {/* 3. Total Purchases (إجمالي المشتريات) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500">إجمالي قيمة الفواتير</span>
              <div className="mt-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-800">
                    {summary.total_invoices_amount.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-bold text-slate-600">ليرة</span>
                </div>
              </div>
              <span className="text-[10px] font-bold mt-1 text-slate-500">إجمالي {summary.total_invoices_count} فواتير مسجلة</span>
            </div>

          </div>
        </div>

        {/* Filter Tabs (Uncomplicated 3 Categories) */}
        <div className="bg-white border border-slate-250 rounded-2xl p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto print:hidden">
          
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span>جميع الفواتير</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {summary.total_invoices_count}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('unpaid')}
            className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'unpaid'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>غير مدفوعة</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'unpaid' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
            }`}>
              {summary.unpaid_count}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('partial')}
            className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'partial'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <Hourglass className="w-3.5 h-3.5" />
            <span>مدفوعة جزئياً</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'partial' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
            }`}>
              {summary.partial_count}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('paid')}
            className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'paid'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>مدفوعة بالكامل</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === 'paid' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {summary.paid_count}
            </span>
          </button>

        </div>

        {/* Invoices List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800">
              قائمة الفواتير وتفاصيلها ({filteredOrders.length})
            </h3>
            <span className="text-[11px] font-bold text-slate-450">
              اضغط على أي فاتورة لفتح تفاصيل المواد والدفعات
            </span>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-white border border-slate-250 rounded-3xl p-10 text-center space-y-3 shadow-xs">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">لا توجد فواتير في هذا التصنيف</h4>
              <p className="text-xs text-slate-400">يمكنك اختيار تبويب آخر لعرض الفواتير المسجلة.</p>
            </div>
          ) : (
            filteredOrders.map((order, idx) => {
              const isExpanded = Boolean(expandedOrders[order.id]);
              const isLatest = idx === 0;

              return (
                <div
                  key={order.id}
                  className={`bg-white border transition-all rounded-3xl shadow-xs overflow-hidden ${
                    isExpanded ? 'border-emerald-500/60 ring-2 ring-emerald-500/10' : 'border-slate-250 hover:border-slate-300'
                  }`}
                >
                  {/* Invoice Header / Clickable Card */}
                  <div
                    onClick={() => toggleOrder(order.id)}
                    className="p-4 sm:p-5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${
                        order.payment_status === 'paid'
                          ? 'bg-emerald-100 text-emerald-700'
                          : order.payment_status === 'partial'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {order.payment_status === 'paid' ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : order.payment_status === 'partial' ? (
                          <Hourglass className="w-5 h-5" />
                        ) : (
                          <AlertCircle className="w-5 h-5" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-800">
                            فاتورة #{order.id.slice(0, 8).toUpperCase()}
                          </span>

                          {isLatest && (
                            <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                              آخر فاتورة
                            </span>
                          )}

                          {/* Status Badge */}
                          <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full ${
                            order.payment_status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.payment_status === 'partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {order.payment_status === 'paid'
                              ? 'مدفوعة بالكامل'
                              : order.payment_status === 'partial'
                              ? 'مدفوعة جزئياً'
                              : 'غير مدفوعة (دين)'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-450 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatDate(order.created_at)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {formatTime(order.created_at)}
                          </span>
                          <span>•</span>
                          <span>{order.order_items.length} مواد</span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Numbers for the Invoice */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-right sm:text-left">
                        <div className="text-xs font-bold text-slate-800">
                          الإجمالي: <span className="font-black text-sm">{order.total_price.toFixed(2)} TL</span>
                        </div>
                        <div className="text-[11px] font-bold mt-0.5">
                          {order.remaining_amount > 0 ? (
                            <span className="text-rose-600">المتبقي: {order.remaining_amount.toFixed(2)} TL</span>
                          ) : (
                            <span className="text-emerald-600">مسددة بالكامل ✓</span>
                          )}
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Body: Items and Payments */}
                  {isExpanded && (
                    <div className="border-t border-slate-150 p-4 sm:p-6 bg-slate-50/50 space-y-6">
                      
                      {/* 1. Products / Items list */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                            <ShoppingBag className="w-4 h-4 text-emerald-600" />
                            <span>محتويات الفاتورة ({order.order_items.length} صنف)</span>
                          </h4>
                          <Link
                            href={`/invoice/${order.id}`}
                            target="_blank"
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 underline"
                          >
                            <span>فتح الفاتورة الأصلية المستقلة</span>
                          </Link>
                        </div>

                        <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 p-2 sm:p-3">
                          {order.order_items.map((item) => (
                            <div key={item.id} className="py-2.5 px-2 flex items-center justify-between gap-3 text-xs">
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-800 truncate">{item.product_name}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-semibold">
                                  <span>الكمية: {item.quantity} صندوق</span>
                                  {item.price_at_purchase > 0 && (
                                    <>
                                      <span>•</span>
                                      <span>سعر الصندوق: {item.price_at_purchase.toFixed(2)} TL</span>
                                    </>
                                  )}
                                </div>
                                {item.applied_offer && (
                                  <div className="mt-1 inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px]">
                                    <Gift className="w-3 h-3 text-amber-600" />
                                    <span>{item.applied_offer}</span>
                                  </div>
                                )}
                              </div>

                              <div className="text-left font-black text-slate-800 whitespace-nowrap">
                                {(item.quantity * item.price_at_purchase).toFixed(2)} TL
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 2. Recorded Payments & Notes (سجل الدفعات) */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                            <Receipt className="w-4 h-4 text-blue-600" />
                            <span>سجل الدفعات والمقبوضات لهذه الفاتورة ({order.payments.length})</span>
                          </h4>
                          <span className="text-[11px] font-bold text-slate-600">
                            مجموع المقبوض: <span className="text-emerald-700 font-black">{order.paid_amount.toFixed(2)} TL</span>
                          </span>
                        </div>

                        {order.payments.length === 0 ? (
                          <div className="p-4 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-xs text-slate-500 font-bold">
                            لم تسجل أي دفعة لهذه الفاتورة حتى الآن (قيمة الفاتورة كاملة باقية كدين).
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {order.payments.map((payment, pIdx) => (
                              <div
                                key={payment.id}
                                className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                                      {pIdx + 1}
                                    </span>
                                    <span className="text-xs font-black text-slate-800">
                                      دفعة بقيمة: {payment.amount.toFixed(2)} TL
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      {formatDate(payment.created_at)} - {formatTime(payment.created_at)}
                                    </span>
                                  </div>

                                  {/* Explanation / Clarification note */}
                                  {payment.note && (
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2 text-xs font-bold text-slate-700 flex items-start gap-1.5 mr-7">
                                      <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                                      <span>توضيح الإدارة: {payment.note}</span>
                                    </div>
                                  )}
                                </div>

                                <div className="text-right sm:text-left text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl w-fit">
                                  ✓ تم الخصم من الحساب
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Invoice Bottom Financial Summary */}
                      {showPrices && (
                        <div className="p-4 rounded-2xl bg-white border border-slate-250 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-4 text-slate-700 font-bold">
                            <span>إجمالي الفاتورة: <b>{order.total_price.toFixed(2)} TL</b></span>
                            <span>•</span>
                            <span>المدفوع: <b className="text-emerald-700">{order.paid_amount.toFixed(2)} TL</b></span>
                          </div>

                          <div className="font-black text-sm">
                            المتبقي من هذه الفاتورة: <span className={order.remaining_amount > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                              {order.remaining_amount.toFixed(2)} TL
                            </span>
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Support & WhatsApp Contact */}
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
    </div>
  );
}
