'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Users, DollarSign, Receipt, AlertCircle, CheckCircle2, Hourglass, 
  Search, RefreshCw, Plus, Trash2, Copy, Check, ExternalLink, 
  ArrowRight, FileText, Calendar, Clock, ShoppingBag, Eye, 
  ChevronDown, ChevronUp, Link as LinkIcon, Filter, Layers, UserCheck
} from 'lucide-react';

interface Payment {
  id: string;
  order_id: string;
  customer_id?: string | null;
  amount: number;
  note?: string | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  product_name?: string | null;
  quantity: number;
  price_at_purchase: number;
  applied_offer?: string | null;
}

interface Order {
  id: string;
  customer_id?: string | null;
  customer_name: string;
  total_price: number;
  calculated_total?: number;
  status: string;
  created_at: string;
  paid_amount?: number;
  remaining_amount?: number;
  payment_status?: 'unpaid' | 'partial' | 'paid';
  payments?: Payment[];
  order_items: OrderItem[];
}

interface CustomerSummary {
  id: string;
  name: string;
  show_prices: boolean;
  statement_token: string;
  statement_url: string;
  created_at: string;
  total_invoices_count: number;
  unpaid_count: number;
  partial_count: number;
  paid_count: number;
  total_invoices_amount: number;
  total_paid_amount: number;
  total_remaining_debt: number;
  orders: Order[];
}

export default function AdminLedgerPage() {
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<Order[]>([]);
  const [grandSummary, setGrandSummary] = useState({
    total_customers: 0,
    customers_with_debt: 0,
    grand_total_debt: 0,
    grand_total_paid: 0,
    grand_total_invoices: 0,
    unassigned_orders_count: 0
  });

  // Selected customer for detailed view
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustTab, setSelectedCustTab] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Payment form states (per order)
  const [paymentAmount, setPaymentAmount] = useState<Record<string, string>>({});
  const [paymentNote, setPaymentNote] = useState<Record<string, string>>({});

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'debt_only' | 'settled_only'>('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Unassigned Orders Modal
  const [showUnassignedModal, setShowUnassignedModal] = useState(false);
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [selectedCustomerForAssign, setSelectedCustomerForAssign] = useState<string>('');

  const fetchLedgerData = async () => {
    try {
      setLoading(true);
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

      if (!isUrlConfigured) {
        throw new Error('Using local/mock storage mode');
      }

      const res = await fetch('/api/admin/ledger');
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل جلب بيانات الديون');
      }

      setCustomers(data.customers || []);
      setGrandSummary(data.summary || {
        total_customers: 0,
        customers_with_debt: 0,
        grand_total_debt: 0,
        grand_total_paid: 0,
        grand_total_invoices: 0,
        unassigned_orders_count: 0
      });
      setUnassignedOrders(data.unassigned_orders || []);
      setUsingMock(false);
    } catch (err: any) {
      console.warn('Could not fetch ledger from DB, loading mock fallback data', err);
      loadMockLedger();
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  const loadMockLedger = () => {
    const localCustomers = JSON.parse(localStorage.getItem('idlebi_customers') || '[]');
    const localCustList = localCustomers.length > 0 ? localCustomers : [
      { id: 'c1', name: 'سوبر ماركت الياسمين', created_at: new Date().toISOString(), show_prices: true },
      { id: 'c2', name: 'بقالة النور', created_at: new Date().toISOString(), show_prices: false },
      { id: 'c3', name: 'أسواق أورفا الغذائية', created_at: new Date().toISOString(), show_prices: true },
      { id: 'c4', name: 'مطعم السلام الدمشقي', created_at: new Date().toISOString(), show_prices: true }
    ];

    // Seed mock orders and payments
    const mockCustSummaries: CustomerSummary[] = localCustList.map((c: any, idx: number) => {
      const token = c.statement_token || c.id;
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

      const mockOrders: Order[] = [
        {
          id: `m-ord-${c.id}-1`,
          customer_id: c.id,
          customer_name: c.name,
          total_price: 5000 + idx * 1500,
          calculated_total: 5000 + idx * 1500,
          status: 'pending',
          created_at: new Date(Date.now() - idx * 86400000).toISOString(),
          paid_amount: idx === 1 ? 0 : 2000,
          remaining_amount: (5000 + idx * 1500) - (idx === 1 ? 0 : 2000),
          payment_status: idx === 1 ? 'unpaid' : 'partial',
          payments: idx === 1 ? [] : [
            { id: `p-${c.id}-1`, order_id: `m-ord-${c.id}-1`, amount: 2000, note: 'دفعة نقدية باليد', created_at: new Date().toISOString() }
          ],
          order_items: [
            { id: `it-1`, product_name: 'شاي تركي غوكسو 100 ظرف', quantity: 20, price_at_purchase: 85 },
            { id: `it-2`, product_name: 'كوكا كولا علب 330 مل', quantity: 132, price_at_purchase: 25 }
          ]
        },
        {
          id: `m-ord-${c.id}-2`,
          customer_id: c.id,
          customer_name: c.name,
          total_price: 3500,
          calculated_total: 3500,
          status: 'delivered',
          created_at: new Date(Date.now() - (idx + 3) * 86400000).toISOString(),
          paid_amount: 3500,
          remaining_amount: 0,
          payment_status: 'paid',
          payments: [
            { id: `p-${c.id}-2`, order_id: `m-ord-${c.id}-2`, amount: 3500, note: 'حوالة بنكية كاملة', created_at: new Date(Date.now() - 2 * 86400000).toISOString() }
          ],
          order_items: [
            { id: `it-3`, product_name: 'صلصة طماطم تات 800 غ', quantity: 50, price_at_purchase: 70 }
          ]
        }
      ];

      const totalInvoices = mockOrders.reduce((sum, o) => sum + (o.calculated_total || o.total_price), 0);
      const totalPaid = mockOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
      const remainingDebt = totalInvoices - totalPaid;

      return {
        id: c.id,
        name: c.name,
        show_prices: c.show_prices ?? true,
        statement_token: token,
        statement_url: `${origin}/statement/${token}`,
        created_at: c.created_at || new Date().toISOString(),
        total_invoices_count: mockOrders.length,
        unpaid_count: mockOrders.filter(o => o.payment_status === 'unpaid').length,
        partial_count: mockOrders.filter(o => o.payment_status === 'partial').length,
        paid_count: mockOrders.filter(o => o.payment_status === 'paid').length,
        total_invoices_amount: totalInvoices,
        total_paid_amount: totalPaid,
        total_remaining_debt: remainingDebt,
        orders: mockOrders
      };
    });

    const grandDebt = mockCustSummaries.reduce((sum, c) => sum + c.total_remaining_debt, 0);
    const grandPaid = mockCustSummaries.reduce((sum, c) => sum + c.total_paid_amount, 0);
    const grandInvoices = mockCustSummaries.reduce((sum, c) => sum + c.total_invoices_amount, 0);
    const withDebt = mockCustSummaries.filter(c => c.total_remaining_debt > 0).length;

    setCustomers(mockCustSummaries);
    setGrandSummary({
      total_customers: mockCustSummaries.length,
      customers_with_debt: withDebt,
      grand_total_debt: grandDebt,
      grand_total_paid: grandPaid,
      grand_total_invoices: grandInvoices,
      unassigned_orders_count: 0
    });
  };

  useEffect(() => {
    fetchLedgerData();
  }, []);

  const handleCopyStatementLink = (url: string, tokenId: string) => {
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}/statement/${tokenId}` : url;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(tokenId);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleAddPayment = async (orderId: string, customerId: string) => {
    const amtStr = paymentAmount[orderId];
    const note = paymentNote[orderId] || '';

    const numAmt = parseFloat(amtStr);
    if (isNaN(numAmt) || numAmt <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    setIsUpdating(true);
    try {
      if (!usingMock) {
        const res = await fetch('/api/admin/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            customerId,
            amount: numAmt,
            note: note.trim() || undefined
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'فشل إضافة الدفعة');
        }
      }

      // Update local state
      setCustomers(prev => prev.map(cust => {
        if (cust.id === customerId) {
          const updatedOrders = cust.orders.map(order => {
            if (order.id === orderId) {
              const currentPaid = order.paid_amount || 0;
              const newPaid = currentPaid + numAmt;
              const orderTotal = order.calculated_total || order.total_price;
              const newRemaining = Math.max(0, orderTotal - newPaid);
              const newStatus: 'unpaid' | 'partial' | 'paid' = newPaid >= orderTotal ? 'paid' : 'partial';

              const newPayObj: Payment = {
                id: 'pay-' + Date.now(),
                order_id: orderId,
                customer_id: customerId,
                amount: numAmt,
                note: note.trim() || null,
                created_at: new Date().toISOString()
              };

              return {
                ...order,
                paid_amount: newPaid,
                remaining_amount: newRemaining,
                payment_status: newStatus,
                payments: [...(order.payments || []), newPayObj]
              };
            }
            return order;
          });

          const newTotalInvoices = updatedOrders.reduce((sum, o) => sum + (o.calculated_total || o.total_price), 0);
          const newTotalPaid = updatedOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
          const newRemainingDebt = Math.max(0, newTotalInvoices - newTotalPaid);

          return {
            ...cust,
            total_invoices_amount: newTotalInvoices,
            total_paid_amount: newTotalPaid,
            total_remaining_debt: newRemainingDebt,
            unpaid_count: updatedOrders.filter(o => o.payment_status === 'unpaid').length,
            partial_count: updatedOrders.filter(o => o.payment_status === 'partial').length,
            paid_count: updatedOrders.filter(o => o.payment_status === 'paid').length,
            orders: updatedOrders
          };
        }
        return cust;
      }));

      // Clear input fields for this order
      setPaymentAmount(prev => ({ ...prev, [orderId]: '' }));
      setPaymentNote(prev => ({ ...prev, [orderId]: '' }));

      alert('تم تسجيل الدفعة وخصمها من الحساب بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'حدث خطأ أثناء إضافة الدفعة');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeletePayment = async (paymentId: string, orderId: string, customerId: string, amount: number) => {
    const confirm = window.confirm(`هل أنت متأكد من حذف هذه الدفعة بقيمة ${amount.toFixed(2)} TL؟`);
    if (!confirm) return;

    setIsUpdating(true);
    try {
      if (!usingMock) {
        const res = await fetch(`/api/admin/payments?id=${paymentId}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'فشل حذف الدفعة');
        }
      }

      // Update state
      setCustomers(prev => prev.map(cust => {
        if (cust.id === customerId) {
          const updatedOrders = cust.orders.map(order => {
            if (order.id === orderId) {
              const newPayments = (order.payments || []).filter(p => p.id !== paymentId);
              const newPaid = newPayments.reduce((sum, p) => sum + Number(p.amount), 0);
              const orderTotal = order.calculated_total || order.total_price;
              const newRemaining = Math.max(0, orderTotal - newPaid);
              const newStatus: 'unpaid' | 'partial' | 'paid' = newPaid <= 0 ? 'unpaid' : (newPaid >= orderTotal ? 'paid' : 'partial');

              return {
                ...order,
                paid_amount: newPaid,
                remaining_amount: newRemaining,
                payment_status: newStatus,
                payments: newPayments
              };
            }
            return order;
          });

          const newTotalInvoices = updatedOrders.reduce((sum, o) => sum + (o.calculated_total || o.total_price), 0);
          const newTotalPaid = updatedOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
          const newRemainingDebt = Math.max(0, newTotalInvoices - newTotalPaid);

          return {
            ...cust,
            total_invoices_amount: newTotalInvoices,
            total_paid_amount: newTotalPaid,
            total_remaining_debt: newRemainingDebt,
            unpaid_count: updatedOrders.filter(o => o.payment_status === 'unpaid').length,
            partial_count: updatedOrders.filter(o => o.payment_status === 'partial').length,
            paid_count: updatedOrders.filter(o => o.payment_status === 'paid').length,
            orders: updatedOrders
          };
        }
        return cust;
      }));

      alert('تم حذف الدفعة وتحديث الرصيد!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'حدث خطأ أثناء حذف الدفعة');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssignOrder = async () => {
    if (!assigningOrder || !selectedCustomerForAssign) return;
    setIsUpdating(true);

    try {
      if (!usingMock) {
        const res = await fetch('/api/admin/orders/assign-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: assigningOrder.id,
            customerId: selectedCustomerForAssign
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'فشل ربط الفاتورة');
        }
      }

      alert('تم ربط الفاتورة بالزبون بنجاح!');
      setShowUnassignedModal(false);
      setAssigningOrder(null);
      fetchLedgerData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'حدث خطأ أثناء ربط الفاتورة');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Filtered customers list
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'debt_only') return c.total_remaining_debt > 0;
    if (statusFilter === 'settled_only') return c.total_remaining_debt === 0;
    return true;
  });

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="space-y-6 dir-rtl font-sans text-right">
      
      {/* Offline Banner */}
      {usingMock && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
          <span>وضع العرض التجريبي لدفتر الديون نشط. يتم الحساب وتجربة الدفعات محلياً.</span>
        </div>
      )}

      {/* Main View: Overview or Detailed Customer View */}
      {!selectedCustomer ? (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">دفتر الدين وكشف حسابات الزبائن</h1>
              <p className="text-xs text-slate-500 mt-1">متابعة أرصدة الزبائن، تسجيل الدفعات الجزئية، والروابط الدائمة لكشوف الحسابات</p>
            </div>
            <button
              onClick={fetchLedgerData}
              disabled={loading}
              className="p-2.5 bg-white border border-slate-250 hover:border-slate-350 text-slate-600 rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-2 self-start"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-xs font-bold">تحديث البيانات</span>
            </button>
          </div>

          {/* Grand Statistics Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. Total Unpaid Debt Across All Customers */}
            <div className="bg-rose-50/70 border border-rose-200/80 rounded-3xl p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-rose-800">
                <span className="text-xs font-bold">إجمالي الديون المتبقية (كافة الزبائن)</span>
                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-rose-650">
                  {grandSummary.grand_total_debt.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-bold text-rose-900">ليرة</span>
              </div>
              <p className="text-[11px] text-rose-700 font-medium">المبلغ الإجمالي المستحق بذمة الزبائن</p>
            </div>

            {/* 2. Total Collected Payments */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-3xl p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-xs font-bold">إجمالي المقبوضات والمدفوعات</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-700">
                  {grandSummary.grand_total_paid.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-bold text-emerald-900">ليرة</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-medium">المبالغ المسددة والمقبوضة فعلياً</p>
            </div>

            {/* 3. Total Invoices Value */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-xs font-bold">إجمالي قيمة الفواتير الكلية</span>
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-slate-600" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-800">
                  {grandSummary.grand_total_invoices.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-bold text-slate-600">ليرة</span>
              </div>
              <p className="text-[11px] text-slate-450 font-medium">مجموع قيمة كافة الفواتير المسجلة</p>
            </div>

            {/* 4. Customers with Debt Count */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-xs font-bold">زبائن مترتب عليهم ديون</span>
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Users className="w-4 h-4 text-amber-700" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-700">
                  {grandSummary.customers_with_debt}
                </span>
                <span className="text-xs font-bold text-slate-500">من أصل {grandSummary.total_customers} زبون</span>
              </div>
              <p className="text-[11px] text-slate-450 font-medium">عدد الزبائن الذين لديهم رصيد متبقي</p>
            </div>

          </div>

          {/* Unassigned Invoices Warning Banner */}
          {unassignedOrders.length > 0 && (
            <div className="bg-amber-50 border border-amber-250 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-800 shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900">
                    يوجد {unassignedOrders.length} فواتير غير مربوطة بقائمة الزبائن المعتمدين
                  </h4>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    الزبون كتب اسماً مختلفاً أو جديداً، يمكنك تعيين الزبون المعتمد لتنزل الفاتورة في كشف حسابه تلقائياً.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setAssigningOrder(unassignedOrders[0]);
                  setShowUnassignedModal(true);
                }}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0"
              >
                <span>تعيين وربط الفواتير ({unassignedOrders.length})</span>
              </button>
            </div>
          )}

          {/* Customers Ledger Table Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
              
              {/* Search input */}
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ابحث عن اسم زبون في الدفتر..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 outline-none rounded-xl pr-10 pl-4 py-2 text-xs text-slate-800 focus:bg-white focus:border-emerald-600 transition-all font-medium"
                />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === 'all' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  الكل ({customers.length})
                </button>
                <button
                  onClick={() => setStatusFilter('debt_only')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === 'debt_only' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  عليهم ديون ({grandSummary.customers_with_debt})
                </button>
                <button
                  onClick={() => setStatusFilter('settled_only')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === 'settled_only' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  حسابهم خالص ({customers.length - grandSummary.customers_with_debt})
                </button>
              </div>

            </div>

            {/* Customer Cards / Table */}
            {loading ? (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-600">جاري تحميل دفتر الحسابات والديون...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Users className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">لا يوجد زبائن مطابقين للبحث</h4>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredCustomers.map((cust) => {
                  const hasDebt = cust.total_remaining_debt > 0;
                  const isCopied = copiedToken === cust.statement_token;

                  return (
                    <div
                      key={cust.id}
                      className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors p-3 rounded-2xl"
                    >
                      {/* Customer Info */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border ${
                          hasDebt ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          <Users className="w-5 h-5" />
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900">{cust.name}</span>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              hasDebt ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {hasDebt ? `متبقي عليه: ${cust.total_remaining_debt.toFixed(2)} TL` : 'خالص الحساب ✓'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-450 font-medium">
                            <span>{cust.total_invoices_count} فواتير</span>
                            <span>•</span>
                            <span className="text-rose-600 font-bold">{cust.unpaid_count} غير مدفوعة</span>
                            <span>•</span>
                            <span className="text-amber-600 font-bold">{cust.partial_count} جزئية</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-bold">{cust.paid_count} مسددة</span>
                          </div>
                        </div>
                      </div>

                      {/* Amounts & Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        
                        {/* Numbers */}
                        <div className="text-right lg:text-left space-y-0.5 ml-2">
                          <div className="text-xs font-bold text-slate-700">
                            مجموع الفواتير: <span className="font-black text-slate-900">{cust.total_invoices_amount.toFixed(2)} TL</span>
                          </div>
                          <div className="text-[11px] font-bold text-slate-500">
                            المدفوع: <span className="text-emerald-700">{cust.total_paid_amount.toFixed(2)} TL</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          
                          {/* Open detailed statement */}
                          <button
                            onClick={() => {
                              setSelectedCustomerId(cust.id);
                              // Auto expand first order if any
                              if (cust.orders && cust.orders.length > 0) {
                                setExpandedOrders({ [cust.orders[0].id]: true });
                              }
                            }}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>كشف الحساب والدفعات</span>
                          </button>

                          {/* Copy permanent link */}
                          <button
                            onClick={() => handleCopyStatementLink(cust.statement_url, cust.statement_token)}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                            title="نسخ الرابط الدائم للزبون لمشاركته معه"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                            <span>{isCopied ? 'تم النسخ!' : 'نسخ الرابط'}</span>
                          </button>

                          {/* Open public link in new tab */}
                          <Link
                            href={`/statement/${cust.statement_token}`}
                            target="_blank"
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                            title="معاينة صفحة كشف الحساب الخاصة بالزبون"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>

                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </>
      ) : (
        /* Detailed Single Customer View inside Admin */
        <div className="space-y-6">
          
          {/* Back button & Title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="p-2.5 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 rounded-xl transition-all cursor-pointer shadow-xs"
                title="الرجوع لقائمة دفتر الديون"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-black text-slate-900">
                  كشف حساب: {selectedCustomer.name}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">تفاصيل الفواتير، الدفعات المسجلة، وإضافة دفعات جديدة</p>
              </div>
            </div>

            {/* Permanent Link Bar */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-2xl shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>رابط الزبون الدائم:</span>
              </div>
              <button
                onClick={() => handleCopyStatementLink(selectedCustomer.statement_url, selectedCustomer.statement_token)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
              >
                {copiedToken === selectedCustomer.statement_token ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedToken === selectedCustomer.statement_token ? 'تم نسخ الرابط' : 'نسخ الرابط الدائم'}</span>
              </button>
              <Link
                href={`/statement/${selectedCustomer.statement_token}`}
                target="_blank"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                title="معاينة كشف الحساب كما يظهر للزبون"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Customer Financial Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Remaining Debt */}
            <div className={`p-5 rounded-3xl border shadow-xs space-y-1 ${
              selectedCustomer.total_remaining_debt > 0 
                ? 'bg-rose-50/80 border-rose-200 text-rose-950' 
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            }`}>
              <span className="text-xs font-bold opacity-80">المتبقي كدين بذمة الزبون</span>
              <div className="flex items-baseline gap-1 pt-1">
                <span className={`text-2xl font-black ${
                  selectedCustomer.total_remaining_debt > 0 ? 'text-rose-650' : 'text-emerald-700'
                }`}>
                  {selectedCustomer.total_remaining_debt.toFixed(2)}
                </span>
                <span className="text-xs font-bold">ليرة</span>
              </div>
              <p className="text-[11px] font-bold opacity-75">
                {selectedCustomer.total_remaining_debt > 0 ? 'مجموع الذمم المتبقية' : 'الحساب خالص تماماً ✓'}
              </p>
            </div>

            {/* Total Paid */}
            <div className="p-5 rounded-3xl bg-emerald-50/60 border border-emerald-200 text-emerald-950 shadow-xs space-y-1">
              <span className="text-xs font-bold opacity-80">مجموع المبالغ المسددة</span>
              <div className="flex items-baseline gap-1 pt-1">
                <span className="text-2xl font-black text-emerald-700">
                  {selectedCustomer.total_paid_amount.toFixed(2)}
                </span>
                <span className="text-xs font-bold">ليرة</span>
              </div>
              <p className="text-[11px] font-bold text-emerald-800">إجمالي الدفعات المقبوضة</p>
            </div>

            {/* Total Invoices */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200 text-slate-900 shadow-xs space-y-1">
              <span className="text-xs font-bold text-slate-500">إجمالي قيمة الفواتير</span>
              <div className="flex items-baseline gap-1 pt-1">
                <span className="text-2xl font-black text-slate-800">
                  {selectedCustomer.total_invoices_amount.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-slate-600">ليرة</span>
              </div>
              <p className="text-[11px] font-bold text-slate-450">إجمالي {selectedCustomer.total_invoices_count} فواتير</p>
            </div>

          </div>

          {/* Filter Tabs for Customer Invoices */}
          <div className="bg-white border border-slate-200 rounded-2xl p-1.5 shadow-2xs flex items-center gap-1.5 overflow-x-auto">
            
            <button
              onClick={() => setSelectedCustTab('all')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                selectedCustTab === 'all' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>جميع الفواتير ({selectedCustomer.total_invoices_count})</span>
            </button>

            <button
              onClick={() => setSelectedCustTab('unpaid')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                selectedCustTab === 'unpaid' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>غير مدفوعة ({selectedCustomer.unpaid_count})</span>
            </button>

            <button
              onClick={() => setSelectedCustTab('partial')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                selectedCustTab === 'partial' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Hourglass className="w-3.5 h-3.5" />
              <span>مدفوعة جزئياً ({selectedCustomer.partial_count})</span>
            </button>

            <button
              onClick={() => setSelectedCustTab('paid')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                selectedCustTab === 'paid' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>مدفوعة بالكامل ({selectedCustomer.paid_count})</span>
            </button>

          </div>

          {/* List of Invoices & Payment Adding Forms */}
          <div className="space-y-4">
            {selectedCustomer.orders
              .filter(order => {
                if (selectedCustTab === 'unpaid') return order.payment_status === 'unpaid';
                if (selectedCustTab === 'partial') return order.payment_status === 'partial';
                if (selectedCustTab === 'paid') return order.payment_status === 'paid';
                return true;
              })
              .map((order) => {
                const isExpanded = Boolean(expandedOrders[order.id]);
                const orderTotal = order.calculated_total || order.total_price;
                const paid = order.paid_amount || 0;
                const remaining = order.remaining_amount !== undefined ? order.remaining_amount : Math.max(0, orderTotal - paid);

                return (
                  <div
                    key={order.id}
                    className={`bg-white border rounded-3xl shadow-xs overflow-hidden transition-all ${
                      isExpanded ? 'border-emerald-500/60 ring-2 ring-emerald-500/10' : 'border-slate-200'
                    }`}
                  >
                    {/* Invoice Summary Header */}
                    <div
                      onClick={() => setExpandedOrders(prev => ({ ...prev, [order.id]: !prev[order.id] }))}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-2xl shrink-0 ${
                          order.payment_status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : order.payment_status === 'partial'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {order.payment_status === 'paid' ? <CheckCircle2 className="w-5 h-5" /> : order.payment_status === 'partial' ? <Hourglass className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-800">فاتورة #{order.id.slice(0, 8).toUpperCase()}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : order.payment_status === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {order.payment_status === 'paid' ? 'مدفوعة بالكامل' : order.payment_status === 'partial' ? 'مدفوعة جزئياً' : 'غير مدفوعة (دين كامل)'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-450 font-medium flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(order.created_at)}
                            </span>
                            <span>•</span>
                            <span>{order.order_items.length} مواد</span>
                          </div>
                        </div>
                      </div>

                      {/* Amounts */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-right sm:text-left">
                          <div className="text-xs font-bold text-slate-700">
                            الإجمالي: <span className="font-black text-sm">{orderTotal.toFixed(2)} TL</span>
                          </div>
                          <div className="text-[11px] font-bold mt-0.5">
                            {remaining > 0 ? (
                              <span className="text-rose-600">المتبقي: {remaining.toFixed(2)} TL</span>
                            ) : (
                              <span className="text-emerald-600">خالصة بالكامل ✓</span>
                            )}
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Body */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 p-5 bg-slate-50/60 space-y-5">
                        
                        {/* 1. Items breakdown */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span>المواد والأسعار</span>
                            <Link
                              href={`/invoice/${order.id}`}
                              target="_blank"
                              className="text-emerald-700 hover:underline flex items-center gap-1"
                            >
                              <span>معاينة الفاتورة المستقلة</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>

                          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 p-2">
                            {order.order_items.map((item) => (
                              <div key={item.id} className="p-2 flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-800">{item.product_name}</span>
                                <div className="text-slate-600 font-medium">
                                  {item.quantity} صندوق × {item.price_at_purchase.toFixed(2)} TL = <b className="text-slate-900">{(item.quantity * item.price_at_purchase).toFixed(2)} TL</b>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 2. Recorded Payments List */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span>سجل الدفعات المسجلة لهذه الفاتورة ({order.payments?.length || 0})</span>
                            <span className="text-emerald-700">المسدد حتى الآن: {paid.toFixed(2)} TL</span>
                          </div>

                          {(!order.payments || order.payments.length === 0) ? (
                            <div className="p-3.5 bg-white border border-dashed border-slate-300 rounded-2xl text-center text-xs text-slate-400 font-bold">
                              لم يتم تسجيل أي دفعة لهذه الفاتورة بعد.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {order.payments.map((p, pIdx) => (
                                <div
                                  key={p.id}
                                  className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs"
                                >
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center">
                                        {pIdx + 1}
                                      </span>
                                      <span className="text-xs font-black text-emerald-700">
                                        {p.amount.toFixed(2)} TL
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-medium">
                                        {formatDate(p.created_at)}
                                      </span>
                                    </div>
                                    {p.note && (
                                      <p className="text-xs text-slate-600 font-medium mr-7">
                                        توضيح: <span className="font-bold">{p.note}</span>
                                      </p>
                                    )}
                                  </div>

                                  <button
                                    onClick={() => handleDeletePayment(p.id, order.id, selectedCustomer.id, p.amount)}
                                    disabled={isUpdating}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="حذف هذه الدفعة"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 3. Add Payment to this Invoice Form */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Plus className="w-4 h-4 text-emerald-600" />
                            <span>إضافة دفعة جديدة لهذه الفاتورة</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-600">المبلغ المدفوع (TL)</label>
                              <input
                                type="number"
                                step="any"
                                placeholder={`المتبقي: ${remaining.toFixed(2)}`}
                                value={paymentAmount[order.id] || ''}
                                onChange={(e) => setPaymentAmount(prev => ({ ...prev, [order.id]: e.target.value }))}
                                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-emerald-600"
                              />
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-[11px] font-bold text-slate-600">التوضيح (اختياري - يظهر للزبون في كشف الحساب)</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="مثال: نقداً باليد، حوالة بنكية، مع السائق..."
                                  value={paymentNote[order.id] || ''}
                                  onChange={(e) => setPaymentNote(prev => ({ ...prev, [order.id]: e.target.value }))}
                                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-emerald-600"
                                />
                                <button
                                  onClick={() => handleAddPayment(order.id, selectedCustomer.id)}
                                  disabled={isUpdating || !paymentAmount[order.id]}
                                  className="px-4 py-2 bg-[#128C7E] hover:bg-[#128C7E]/90 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all whitespace-nowrap"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>{isUpdating ? 'جاري الحفظ...' : 'تسجيل الدفعة'}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
          </div>

        </div>
      )}

      {/* Assign Unassigned Order Modal */}
      {showUnassignedModal && assigningOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-right">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-600" />
              <span>ربط الفاتورة #{assigningOrder.id.slice(0, 8).toUpperCase()} بزَبون معتمد</span>
            </h3>

            <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
              <p className="text-slate-600">الاسم المكتوب في الطلب: <b className="text-slate-900">{assigningOrder.customer_name}</b></p>
              <p className="text-slate-600">قيمة الفاتورة: <b className="text-emerald-700">{assigningOrder.total_price.toFixed(2)} TL</b></p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">اختر الزبون من قائمة الزبائن المعتمدين:</label>
              <select
                value={selectedCustomerForAssign}
                onChange={(e) => setSelectedCustomerForAssign(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="">-- اختر زبوناً --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowUnassignedModal(false);
                  setAssigningOrder(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={handleAssignOrder}
                disabled={!selectedCustomerForAssign || isUpdating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                تأكيد الربط
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
