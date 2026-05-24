'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TrendingUp, DollarSign, FileText, Users, ShoppingBag, Calendar, Search, RefreshCw, X, AlertCircle, Loader2 } from 'lucide-react';

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
  totalSales: number;
}

export default function AdminStatistics() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');

  // SEED DATA FOR DEMO MODE
  const getMockHistoricalOrders = (): Order[] => {
    const todayStr = new Date().toISOString();
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString();
    const threeDaysAgoStr = new Date(Date.now() - 3 * 86400000).toISOString();

    return [
      {
        id: 'h-ord1',
        customer_name: 'سوبر ماركت الياسمين',
        total_price: 475.00,
        status: 'delivered',
        created_at: todayStr,
        order_items: [
          { id: 'hi-1', order_id: 'h-ord1', product_id: 'p4', quantity: 10, price_at_purchase: 25.00, products: { name: 'كوكا كولا علب 330 مل' } },
          { id: 'hi-2', order_id: 'h-ord1', product_id: 'p1', quantity: 5, price_at_purchase: 45.00, products: { name: 'بسكويت شوكولاتة أولكر 12 قطعة' } }
        ]
      },
      {
        id: 'h-ord2',
        customer_name: 'بقالة النور',
        total_price: 620.00,
        status: 'delivered',
        created_at: yesterdayStr,
        order_items: [
          { id: 'hi-3', order_id: 'h-ord2', product_id: 'p1', quantity: 10, price_at_purchase: 45.00, products: { name: 'بسكويت شوكولاتة أولكر 12 قطعة' } },
          { id: 'hi-4', order_id: 'h-ord2', product_id: 'p3', quantity: 2, price_at_purchase: 85.00, products: { name: 'شاي تركي غوكسو 100 ظرف' } }
        ]
      },
      {
        id: 'h-ord3',
        customer_name: 'أسواق أورفا الغذائية',
        total_price: 195.00,
        status: 'delivered',
        created_at: yesterdayStr,
        order_items: [
          { id: 'hi-5', order_id: 'h-ord3', product_id: 'p4', quantity: 3, price_at_purchase: 25.00, products: { name: 'كوكا كولا علب 330 مل' } },
          { id: 'hi-6', order_id: 'h-ord3', product_id: 'p1', quantity: 2, price_at_purchase: 60.00, products: { name: 'شوكولاتة داماك بالفستق 80 غ' } }
        ]
      },
      {
        id: 'h-ord4',
        customer_name: 'مطعم السلام الدمشقي',
        total_price: 485.00,
        status: 'delivered',
        created_at: threeDaysAgoStr,
        order_items: [
          { id: 'hi-7', order_id: 'h-ord4', product_id: 'p5', quantity: 5, price_at_purchase: 55.00, products: { name: 'صلصة طماطم تات 800 غ' } },
          { id: 'hi-8', order_id: 'h-ord4', product_id: 'p6', quantity: 3, price_at_purchase: 70.00, products: { name: 'أرز تركي بالدو 1 كغ' } }
        ]
      }
    ];
  };

  const fetchHistoricalOrders = async () => {
    try {
      setLoading(true);
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      
      if (!isUrlConfigured) {
        throw new Error('Supabase environment variables not configured');
      }

      // Fetch all delivered orders
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
        .eq('status', 'delivered')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedOrders: Order[] = (data || []).map((order: any) => ({
        ...order,
        order_items: (order.order_items || []).map((item: any) => ({
          ...item,
          products: item.products ? { name: item.products.name } : null
        }))
      }));

      setOrders(typedOrders);
      setUsingMockData(false);
    } catch (err) {
      console.warn('Could not fetch historical orders. Loading mock historical dataset.', err);
      setOrders(getMockHistoricalOrders());
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoricalOrders();
  }, []);

  // Filter logic on the fly
  const filteredOrders = orders.filter((order) => {
    const orderDate = new Date(order.created_at).toISOString().split('T')[0];
    const matchesDate = !dateFilter || orderDate === dateFilter;
    const matchesCustomer = !customerFilter || order.customer_name.toLowerCase().includes(customerFilter.toLowerCase());
    return matchesDate && matchesCustomer;
  });

  // Analytics based strictly on FILTERED subset
  const filteredRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.total_price), 0);
  const filteredInvoicesCount = filteredOrders.length;
  
  const uniqueCustomers = new Set(filteredOrders.map(o => o.customer_name.trim()));
  const filteredUniqueClientsCount = uniqueCustomers.size;

  // Aggregate quantities sold in the filtered range
  const calculateAggregatedSoldItems = (): AggregatedItem[] => {
    const productAggregation: { [name: string]: { qty: number, sales: number } } = {};
    
    filteredOrders.forEach((order) => {
      order.order_items.forEach((item) => {
        const productName = item.products?.name || 'منتج غير معروف';
        const itemSales = item.quantity * Number(item.price_at_purchase);
        
        if (!productAggregation[productName]) {
          productAggregation[productName] = { qty: 0, sales: 0 };
        }
        productAggregation[productName].qty += item.quantity;
        productAggregation[productName].sales += itemSales;
      });
    });

    return Object.keys(productAggregation).map((name) => ({
      productName: name,
      totalQty: productAggregation[name].qty,
      totalSales: productAggregation[name].sales,
    })).sort((a, b) => b.totalQty - a.totalQty); // Sort by quantity sold descending
  };

  const aggregatedSoldItems = calculateAggregatedSoldItems();

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
      return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Offline Demo Banner */}
      {usingMockData && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
          <span>وضع العرض التجريبي للمحفوظات نشط. يمكنك اختبار الفلاتر الزمنية والبحث عن المحلات لمشاهدة تحديث المؤشرات تلقائياً.</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">إحصائيات وأرشيف المبيعات</h1>
          <p className="text-xs text-slate-400 mt-1">تتبع المبيعات الإجمالية، فحص الفواتير المؤرشفة، وفلترة طلبيات الزبائن حسب الاسم والتاريخ</p>
        </div>
        <button
          onClick={fetchHistoricalOrders}
          className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
          title="تحديث البيانات"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Dynamic Filters Form Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
          
          {/* Customer Search input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400">بحث باسم المشتري / المحل</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-3 flex items-center text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="ابحث عن زبون..."
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 outline-none rounded-xl pr-9 pl-4 py-2.5 text-xs text-white placeholder-slate-550 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-right"
              />
            </div>
          </div>

          {/* Date Picker Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-400">تاريخ تسليم الطلبية</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-3 flex items-center text-slate-500 pointer-events-none">
                <Calendar className="w-4 h-4" />
              </span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker()}
                className="w-full bg-slate-950 border border-slate-850 outline-none rounded-xl pr-9 pl-4 py-2.5 text-xs text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-right cursor-pointer"
              />
            </div>
          </div>

          {/* Clear Button */}
          {(dateFilter || customerFilter) && (
            <button
              onClick={() => {
                setDateFilter('');
                setCustomerFilter('');
              }}
              className="h-10 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer w-full sm:col-span-2 md:col-span-1"
            >
              <X className="w-4.5 h-4.5" />
              <span>إعادة تعيين الفلاتر</span>
            </button>
          )}

        </div>
      </div>

      {/* FILTERED KPI STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center gap-4">
          <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold">مبيعات الفلاتر الحالية</p>
            <h3 className="text-2xl font-black text-emerald-400 mt-1">{filteredRevenue.toFixed(2)} TL</h3>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center gap-4">
          <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-400 border border-emerald-500/20">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold">فواتير سُلمت في النطاق</p>
            <h3 className="text-2xl font-black text-white mt-1">{filteredInvoicesCount} فواتير</h3>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center gap-4">
          <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-400 border border-emerald-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold">زبائن مميزين مخدومين</p>
            <h3 className="text-2xl font-black text-white mt-1">{filteredUniqueClientsCount} زبائن</h3>
          </div>
        </div>
      </div>

      {/* Filtered Sales Item Aggregator */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-400 border border-blue-500/20">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-md font-bold text-white">إجمالي المنتجات والسلع المباعة (في الفلاتر الحالية)</h2>
            <p className="text-[11px] text-slate-400">الكميات التراكمية المباعة من كل منتج وقيمتها المالية الإجمالية</p>
          </div>
        </div>

        {aggregatedSoldItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {aggregatedSoldItems.map((item, idx) => (
              <div 
                key={idx}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex items-center justify-between hover:border-slate-800 transition-colors"
              >
                <div className="space-y-1">
                  <span className="text-sm font-semibold text-slate-300 block">{item.productName}</span>
                  <span className="text-[10px] text-emerald-400/80 font-bold font-mono">الإيراد: {item.totalSales.toFixed(2)} TL</span>
                </div>
                <span className="bg-slate-900 text-emerald-400 font-extrabold px-3 py-1.5 rounded-xl text-sm border border-slate-800">
                  {item.totalQty} علبة / صندوق
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-700 mx-auto" />
            <h3 className="text-sm font-bold text-slate-400">لا يوجد كميات مباعة</h3>
            <p className="text-xs text-slate-500">لا تطابق الفلاتر الحالية أي طلبيات مسجلة.</p>
          </div>
        )}
      </div>

      {/* Historical Detailed Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="bg-purple-500/10 p-2.5 rounded-xl text-purple-400 border border-purple-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-md font-bold text-white">سجل الفواتير الفردية المستلمة</h2>
            <p className="text-[11px] text-slate-400">تصفح الفواتير المطابقة بالتفصيل والأسعار وقت الشراء</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-xs font-bold">جاري تحميل محفوظات الفواتير...</p>
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div 
                key={order.id}
                className="bg-slate-950 border border-slate-850 rounded-2xl p-5 space-y-4 hover:border-slate-800 transition-all"
              >
                {/* Order Header Info */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-900">
                  <div>
                    <h3 className="text-sm font-bold text-white">{order.customer_name}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1.5">
                      <span>التاريخ: {formatDate(order.created_at)}</span>
                      <span>•</span>
                      <span>الوقت: {formatTime(order.created_at)}</span>
                    </div>
                  </div>
                  <span className="bg-slate-900 border border-slate-800 text-emerald-400 font-extrabold px-3 py-1.5 rounded-xl text-xs">
                    {Number(order.total_price).toFixed(2)} TL
                  </span>
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
            <FileText className="w-10 h-10 text-slate-700 mx-auto" />
            <h3 className="text-sm font-bold text-slate-400">لم نجد أي طلبيات مطابقة للبحث</h3>
            <p className="text-xs text-slate-500">جرب تعديل التاريخ أو تصفية مدخلات اسم الزبون.</p>
          </div>
        )}
      </div>

    </div>
  );
}
