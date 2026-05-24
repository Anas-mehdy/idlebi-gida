'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Users, CheckSquare, ClipboardList, TrendingUp, DollarSign, Clock, AlertCircle, Trash2 } from 'lucide-react';

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  price_at_purchase: number;
  products?: {
    name: string;
  } | null;
}

interface Order {
  id: string;
  customer_name: string;
  total_price: number;
  status: 'pending' | 'delivered';
  created_at: string;
  order_items: OrderItem[];
}

interface AggregatedItem {
  productName: string;
  totalQty: number;
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);

  // Stats
  const [totalRevenueToday, setTotalRevenueToday] = useState(0);
  const [aggregatedItems, setAggregatedItems] = useState<AggregatedItem[]>([]);

  // Seed data for admin preview
  const getMockOrders = (): Order[] => [
    {
      id: 'm-ord1',
      customer_name: 'سوبر ماركت الياسمين',
      total_price: 475.00,
      status: 'pending',
      created_at: new Date().toISOString(),
      order_items: [
        { id: 'mi-1', order_id: 'm-ord1', product_id: 'p4', quantity: 10, price_at_purchase: 25.00, products: { name: 'كوكا كولا علب 330 مل' } },
        { id: 'mi-2', order_id: 'm-ord1', product_id: 'p1', quantity: 5, price_at_purchase: 45.00, products: { name: 'بسكويت شوكولاتة أولكر 12 قطعة' } }
      ]
    },
    {
      id: 'm-ord2',
      customer_name: 'بقالة النور',
      total_price: 620.00,
      status: 'pending',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      order_items: [
        { id: 'mi-3', order_id: 'm-ord2', product_id: 'p1', quantity: 10, price_at_purchase: 45.00, products: { name: 'بسكويت شوكولاتة أولكر 12 قطعة' } },
        { id: 'mi-4', order_id: 'm-ord2', product_id: 'p3', quantity: 2, price_at_purchase: 85.00, products: { name: 'شاي تركي غوكسو 100 ظرف' } }
      ]
    }
  ];

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      
      if (!isUrlConfigured) {
        throw new Error('Supabase environment variables not configured');
      }

      // Fetch pending orders today
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              name
            )
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Make sure order_items and products nested object satisfies our type structure
      const typedOrders: Order[] = (data || []).map((order: any) => ({
        ...order,
        order_items: (order.order_items || []).map((item: any) => ({
          ...item,
          products: item.products ? { name: item.products.name } : null
        }))
      }));

      setOrders(typedOrders);
      calculateStats(typedOrders);
      setUsingMockData(false);
    } catch (err) {
      console.warn('Could not fetch active orders from database. Loading preview mode.', err);
      const mockOrders = getMockOrders();
      setOrders(mockOrders);
      calculateStats(mockOrders);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const calculateStats = (activeOrders: Order[]) => {
    // 1. Revenue
    const revenue = activeOrders.reduce((sum, order) => sum + Number(order.total_price), 0);
    setTotalRevenueToday(revenue);

    // 2. Aggregate quantities needed for fulfillment (Layer 1)
    const productAggregation: { [name: string]: number } = {};
    
    activeOrders.forEach((order) => {
      order.order_items.forEach((item) => {
        const productName = item.products?.name || 'منتج غير معروف';
        productAggregation[productName] = (productAggregation[productName] || 0) + item.quantity;
      });
    });

    const aggregatedList: AggregatedItem[] = Object.keys(productAggregation).map((name) => ({
      productName: name,
      totalQty: productAggregation[name],
    }));

    setAggregatedItems(aggregatedList);
  };

  // Fulfillment Action: Mark all pending as delivered (Purchase renaming)
  const handleFulfillAll = async () => {
    if (orders.length === 0) return;
    const confirmAction = window.confirm('هل أنت متأكد من شراء كافة الطلبيات المعلقة وأرشفتها؟');
    if (!confirmAction) return;

    setIsUpdating(true);
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      
      if (isUrlConfigured) {
        // Fetch all pending ids
        const pendingIds = orders.map(o => o.id);
        const { error } = await supabase
          .from('orders')
          .update({ status: 'delivered' })
          .in('id', pendingIds);

        if (error) throw error;
      } else {
        console.log('Database not connected. Bypassing state update in demo mode.');
      }

      // Success, clear active view
      setOrders([]);
      setTotalRevenueToday(0);
      setAggregatedItems([]);
      alert('تم تحديث حالة الطلبات إلى تم الشراء بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء تحديث حالة الطلبات.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Individual Fulfillment: Mark single order as delivered
  const handleFulfillOrder = async (orderId: string, customerName: string) => {
    const confirmAction = window.confirm(`هل أنت متأكد من تسليم طلبية "${customerName}"؟`);
    if (!confirmAction) return;

    setIsUpdating(true);
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      
      if (isUrlConfigured) {
        const { error } = await supabase
          .from('orders')
          .update({ status: 'delivered' })
          .eq('id', orderId);

        if (error) throw error;
      } else {
        console.log('Database not connected. Bypassing state update in demo mode.');
      }

      // Remove order from active view state
      const updatedOrders = orders.filter(o => o.id !== orderId);
      setOrders(updatedOrders);
      calculateStats(updatedOrders);
      alert('تم تسليم الطلبية ونقلها للأرشيف بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء تحديث حالة الطلبية.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Cancel/Delete active order
  const handleCancelOrder = async (orderId: string, customerName: string) => {
    const confirmAction = window.confirm(`هل أنت متأكد من إلغاء وحذف طلبية "${customerName}"؟`);
    if (!confirmAction) return;

    setIsUpdating(true);
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      
      if (isUrlConfigured) {
        const { error } = await supabase
          .from('orders')
          .delete()
          .eq('id', orderId);

        if (error) throw error;
      } else {
        console.log('Database not connected. Bypassing state update in demo mode.');
      }

      // Remove order from active view state
      const updatedOrders = orders.filter(o => o.id !== orderId);
      setOrders(updatedOrders);
      calculateStats(updatedOrders);
      alert('تم إلغاء وحذف الطلبية بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء إلغاء الطلبية.');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Warning for offline test mode */}
      {usingMockData && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
          <span>وضع معاينة لوحة التحكم نشط. لتفعيل لوحة التحكم الحية، يرجى إدخال إعدادات Supabase في ملف .env.local</span>
        </div>
      )}

      {/* Overview Analytics Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center gap-4">
          <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-400 border border-emerald-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold">زبائن اليوم المعلقين</p>
            <h3 className="text-2xl font-black text-white mt-1">{orders.length} زبائن</h3>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center gap-4">
          <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold">إجمالي مبيعات اليوم المعلقة</p>
            <h3 className="text-2xl font-black text-emerald-400 mt-1">{totalRevenueToday.toFixed(2)} TL</h3>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center gap-4">
          <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-400 border border-emerald-500/20">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold">أنواع السلع المطلوبة</p>
            <h3 className="text-2xl font-black text-white mt-1">{aggregatedItems.length} سلع مختلفة</h3>
          </div>
        </div>
      </div>

      {/* Layer 1: Global Daily Fulfillment Stats */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-400 border border-blue-500/20">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-md font-bold text-white">المستوى 1: تجميع الطلبيات الإجمالي لليوم</h2>
              <p className="text-[11px] text-slate-400">إجمالي الكميات والسلع اللازم تجهيزها من المستودع لتلبية كافة الزبائن</p>
            </div>
          </div>

          {orders.length > 0 && (
            <button
              onClick={handleFulfillAll}
              disabled={isUpdating}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer animate-pulse"
            >
              <CheckSquare className="w-4 h-4" />
              <span>{isUpdating ? 'جاري التحديث...' : 'تم الشراء'}</span>
            </button>
          )}
        </div>

        {aggregatedItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {aggregatedItems.map((item, idx) => (
              <div 
                key={idx}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex items-center justify-between hover:border-slate-800 transition-colors"
              >
                <span className="text-sm font-semibold text-slate-300">{item.productName}</span>
                <span className="bg-slate-900 text-emerald-400 font-extrabold px-3 py-1.5 rounded-xl text-sm border border-slate-800">
                  {item.totalQty} علبة / صندوق
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 space-y-2">
            <CheckSquare className="w-10 h-10 text-slate-700 mx-auto" />
            <h3 className="text-sm font-bold text-slate-400">كل السلع مجهزة وسُلمت للزبائن</h3>
            <p className="text-xs text-slate-500">لا يوجد منتجات معلقة تحتاج للتجهيز من المستودع حالياً.</p>
          </div>
        )}
      </div>

      {/* Layer 2: Customer Order Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="bg-purple-500/10 p-2.5 rounded-xl text-purple-400 border border-purple-500/20">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-md font-bold text-white">المستوى 2: كشف الفواتير والزبائن بالتفصيل</h2>
            <p className="text-[11px] text-slate-400">قائمة بالفواتير الفردية المستلمة وتفاصيل طلب كل زبون</p>
          </div>
        </div>

        {orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <div 
                key={order.id}
                className="bg-slate-950 border border-slate-850 rounded-2xl p-5 space-y-4 hover:border-slate-800 transition-all"
              >
                {/* Order Header Info */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-900">
                  <div>
                    <h3 className="text-sm font-bold text-white">{order.customer_name}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>ساعة الاستلام: {formatTime(order.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-900 border border-slate-800 text-emerald-400 font-extrabold px-3 py-1.5 rounded-xl text-xs">
                      {Number(order.total_price).toFixed(2)} TL
                    </span>
                    <button
                      onClick={() => handleFulfillOrder(order.id, order.customer_name)}
                      disabled={isUpdating}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-550 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                      title="تحديد كـ تم التسليم ونقل للأرشيف"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>تم التسليم</span>
                    </button>
                    <button
                      onClick={() => handleCancelOrder(order.id, order.customer_name)}
                      disabled={isUpdating}
                      className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-450 hover:text-rose-400 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                      title="إلغاء وحذف الطلبية"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إلغاء</span>
                    </button>
                  </div>
                </div>

                {/* Item Details */}
                <div className="space-y-2">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-xs text-slate-400">
                      <span>• {item.products?.name || 'منتج غير متوفر'}</span>
                      <span className="font-semibold text-slate-200">
                        {item.quantity} صندوق × {Number(item.price_at_purchase).toFixed(2)} TL
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 space-y-2">
            <ClipboardList className="w-10 h-10 text-slate-700 mx-auto" />
            <h3 className="text-sm font-bold text-slate-400">لا يوجد فواتير فردية نشطة</h3>
            <p className="text-xs text-slate-500">سيتم سرد الفواتير فور إرسالها من الزبائن في المتجر العام.</p>
          </div>
        )}
      </div>
    </div>
  );
}
