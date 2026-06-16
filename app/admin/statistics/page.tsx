'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  TrendingUp, DollarSign, FileText, Users, ShoppingBag, Calendar, 
  Search, RefreshCw, X, AlertCircle, Loader2,
  Trash2, Copy, Download, Printer, Plus, Edit3, Save, ChevronUp, ChevronDown
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';

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
  status: 'pending' | 'delivered';
  created_at: string;
  order_items: OrderItem[];
}

interface AggregatedItem {
  productName: string;
  totalQty: number;
  totalSales: number;
  imageUrl?: string | null;
}

export default function AdminStatistics() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  
  // Printing and updating states
  const [printType, setPrintType] = useState<'aggregation' | 'invoice' | 'receipt' | 'aggregation_receipt'>('invoice');
  const [activePrintOrder, setActivePrintOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Editing states
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editedPrices, setEditedPrices] = useState<{[itemId: string]: string}>({});
  const [editedQuantities, setEditedQuantities] = useState<{[itemId: string]: number}>({});
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState<{[orderId: string]: boolean}>({});
  const [selectedProdForOrder, setSelectedProdForOrder] = useState<{[orderId: string]: string}>({});
  const [addQtyForOrder, setAddQtyForOrder] = useState<{[orderId: string]: number}>({});
  const [addPriceForOrder, setAddPriceForOrder] = useState<{[orderId: string]: string}>({});
  const [prodSearchQuery, setProdSearchQuery] = useState<{[orderId: string]: string}>({});
  const [showCustomAddForm, setShowCustomAddForm] = useState<{[orderId: string]: boolean}>({});
  const [customProductName, setCustomProductName] = useState<{[orderId: string]: string}>({});
  const [customProductQty, setCustomProductQty] = useState<{[orderId: string]: number}>({});
  const [customProductPrice, setCustomProductPrice] = useState<{[orderId: string]: string}>({});
  const [lastSoldPrices, setLastSoldPrices] = useState<Record<string, number>>({});
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Filters
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
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
          { id: 'hi-1', order_id: 'h-ord1', product_id: 'p4', quantity: 10, price_at_purchase: 25.00, products: { name: 'كوكا كولا علب 330 مل', image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=120&auto=format&fit=crop&q=60' } },
          { id: 'hi-2', order_id: 'h-ord1', product_id: 'p1', quantity: 5, price_at_purchase: 45.00, products: { name: 'بسكويت شوكولاتة أولكر 12 قطعة', image_url: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=120&auto=format&fit=crop&q=60' } }
        ]
      },
      {
        id: 'h-ord2',
        customer_name: 'بقالة النور',
        total_price: 620.00,
        status: 'delivered',
        created_at: yesterdayStr,
        order_items: [
          { id: 'hi-3', order_id: 'h-ord2', product_id: 'p1', quantity: 10, price_at_purchase: 45.00, products: { name: 'بسكويت شوكولاتة أولكر 12 قطعة', image_url: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=120&auto=format&fit=crop&q=60' } },
          { id: 'hi-4', order_id: 'h-ord2', product_id: 'p3', quantity: 2, price_at_purchase: 85.00, products: { name: 'شاي تركي غوكسو 100 ظرف', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=120&auto=format&fit=crop&q=60' } }
        ]
      },
      {
        id: 'h-ord3',
        customer_name: 'أسواق أورفا الغذائية',
        total_price: 195.00,
        status: 'delivered',
        created_at: yesterdayStr,
        order_items: [
          { id: 'hi-5', order_id: 'h-ord3', product_id: 'p4', quantity: 3, price_at_purchase: 25.00, products: { name: 'كوكا كولا علب 330 مل', image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=120&auto=format&fit=crop&q=60' } },
          { id: 'hi-6', order_id: 'h-ord3', product_id: 'p1', quantity: 2, price_at_purchase: 60.00, products: { name: 'شوكولاتة داماك بالفستق 80 غ', image_url: 'https://images.unsplash.com/photo-1549007994-cb92ca87df46?w=120&auto=format&fit=crop&q=60' } }
        ]
      },
      {
        id: 'h-ord4',
        customer_name: 'مطعم السلام الدمشقي',
        total_price: 485.00,
        status: 'delivered',
        created_at: threeDaysAgoStr,
        order_items: [
          { id: 'hi-7', order_id: 'h-ord4', product_id: 'p5', quantity: 5, price_at_purchase: 55.00, products: { name: 'صلصة طماطم تات 800 غ', image_url: 'https://images.unsplash.com/photo-1607305387299-a3d9611cd46f?w=120&auto=format&fit=crop&q=60' } },
          { id: 'hi-8', order_id: 'h-ord4', product_id: 'p6', quantity: 3, price_at_purchase: 70.00, products: { name: 'أرز تركي بالدو 1 كغ', image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=120&auto=format&fit=crop&q=60' } }
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
            product_name,
            product_image,
            products (
              name,
              image_url
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
          product_name: item.product_name,
          product_image: item.product_image,
          products: item.products ? { name: item.products.name, image_url: item.products.image_url } : null
        }))
      }));

      setOrders(typedOrders);
      usingMockData && setUsingMockData(false);
    } catch (err) {
      console.warn('Could not fetch historical orders. Loading mock historical dataset.', err);
      setOrders(getMockHistoricalOrders());
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  // Delete archived order
  const handleDeleteOrder = async (orderId: string, customerName: string) => {
    const confirmAction = window.confirm(`هل أنت متأكد من حذف هذه الفاتورة المؤرشفة لـ "${customerName}" نهائياً من النظام؟ لا يمكن التراجع عن هذه الخطوة.`);
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
        console.log('Database not connected. Bypassing state delete in demo mode.');
      }

      // Remove order from state
      const updatedOrders = orders.filter(o => o.id !== orderId);
      setOrders(updatedOrders);
      alert('تم حذف الفاتورة بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء حذف الفاتورة.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Copy Direct Link
  const handleCopyInvoiceLink = (orderId: string, totalPrice: number) => {
    if (totalPrice <= 0) {
      alert('يرجى تسعير الفاتورة أولاً قبل نسخ الرابط.');
      return;
    }
    const invoiceUrl = `${window.location.origin}/invoice/${orderId}`;
    navigator.clipboard.writeText(invoiceUrl);
    alert('تم نسخ رابط الفاتورة المباشر إلى الحافظة بنجاح!');
  };

  // Optimized PDF Download for WhatsApp sharing
  const handleDownloadPDF = async (order: Order) => {
    setIsUpdating(true);
    try {
      setPrintType('invoice');
      setActivePrintOrder(order);

      // Wait for DOM layout
      await new Promise((resolve) => setTimeout(resolve, 400));

      const input = document.getElementById('customer-invoice-print-sheet');
      if (!input) {
        alert('لم يتم العثور على هيكل الفاتورة للتحويل.');
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
      setIsUpdating(false);
    }
  };

  // Print A4 Invoice
  const handlePrintInvoice = (order: Order) => {
    setPrintType('invoice');
    setActivePrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Print 80mm Receipt
  const handlePrintReceipt = (order: Order) => {
    setPrintType('receipt');
    setActivePrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Fetch all products for add-product forms
  const fetchAllProducts = async () => {
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      if (!isUrlConfigured) return;

      const { data, error } = await supabase
        .from('products')
        .select('id, name, image_url')
        .order('name');

      if (error) throw error;
      setAllProducts(data || []);
    } catch (err) {
      console.warn('Could not fetch products list.', err);
    }
  };

  // Fetch last sold prices from order_items
  const fetchLastSoldPrices = async () => {
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      if (!isUrlConfigured) return;

      const { data, error } = await supabase
        .from('order_items')
        .select('product_id, product_name, price_at_purchase')
        .not('price_at_purchase', 'is', null)
        .gt('price_at_purchase', 0);

      if (!error && data) {
        const pricesMap: Record<string, number> = {};
        data.forEach((item: any) => {
          const key = item.product_id || item.product_name;
          if (key && Number(item.price_at_purchase) > 0) {
            pricesMap[key] = Number(item.price_at_purchase);
          }
        });
        setLastSoldPrices(pricesMap);
      }
    } catch (err) {
      console.warn('Could not fetch last sold prices.', err);
    }
  };

  // Save edited prices and quantities for a delivered order
  const handleSaveArchivedPrices = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    setIsUpdating(true);
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

      const itemsToUpdate = order.order_items.map(item => {
        const newPriceStr = editedPrices[item.id];
        const newPrice = newPriceStr !== undefined && newPriceStr !== '' ? parseFloat(newPriceStr) : (item.price_at_purchase || 0);
        const newQty = editedQuantities[item.id] !== undefined ? editedQuantities[item.id] : item.quantity;
        return {
          id: item.id,
          order_id: orderId,
          product_id: item.product_id,
          quantity: newQty,
          price_at_purchase: newPrice
        };
      });

      const newTotalPrice = itemsToUpdate.reduce((sum, item) => sum + (item.quantity * item.price_at_purchase), 0);

      if (isUrlConfigured) {
        const { error: itemsError } = await supabase
          .from('order_items')
          .upsert(itemsToUpdate);
        if (itemsError) throw itemsError;

        const { error: orderError } = await supabase
          .from('orders')
          .update({ total_price: newTotalPrice })
          .eq('id', orderId);
        if (orderError) throw orderError;
      }

      // Update local state
      const updatedOrders = orders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            total_price: newTotalPrice,
            order_items: o.order_items.map(item => {
              const newPriceStr = editedPrices[item.id];
              const newPrice = newPriceStr !== undefined && newPriceStr !== '' ? parseFloat(newPriceStr) : item.price_at_purchase;
              const newQty = editedQuantities[item.id] !== undefined ? editedQuantities[item.id] : item.quantity;
              return { ...item, price_at_purchase: newPrice, quantity: newQty };
            })
          };
        }
        return o;
      });

      // Update in-memory last sold prices
      const updatedLastPrices = { ...lastSoldPrices };
      itemsToUpdate.forEach(item => {
        const productName = order.order_items.find(oi => oi.id === item.id)?.product_name || '';
        const key = item.product_id || productName;
        if (key && item.price_at_purchase > 0) {
          updatedLastPrices[key] = item.price_at_purchase;
        }
      });
      setLastSoldPrices(updatedLastPrices);

      setOrders(updatedOrders);
      setEditingOrderId(null);
      setEditedPrices({});
      setEditedQuantities({});
      alert('تم حفظ التعديلات وتحديث إجمالي الفاتورة بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ الفاتورة.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Add item from store to archived order
  const handleAddArchivedOrderItem = async (orderId: string) => {
    const prodId = selectedProdForOrder[orderId];
    if (!prodId) { alert('يرجى اختيار منتج أولاً.'); return; }
    const qty = addQtyForOrder[orderId] || 1;
    const priceStr = addPriceForOrder[orderId];
    const price = priceStr ? parseFloat(priceStr) : 0;
    if (qty <= 0) { alert('الكمية يجب أن تكون أكبر من الصفر.'); return; }

    const selectedProduct = allProducts.find(p => p.id === prodId);
    if (!selectedProduct) return;

    setIsUpdating(true);
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const existingItem = order.order_items.find(item => item.product_id === prodId);
      let newTotalPrice = 0;
      if (existingItem) {
        newTotalPrice = order.order_items.reduce((sum, item) => {
          const itemPrice = item.id === existingItem.id ? price : (item.price_at_purchase || 0);
          const itemQty = item.id === existingItem.id ? (item.quantity + qty) : item.quantity;
          return sum + (itemQty * itemPrice);
        }, 0);
      } else {
        newTotalPrice = order.order_items.reduce((sum, item) => sum + (item.quantity * (item.price_at_purchase || 0)), 0) + (qty * price);
      }

      let insertedId = 'temp-' + Date.now();

      if (isUrlConfigured) {
        if (existingItem) {
          const { error } = await supabase.from('order_items').update({ quantity: existingItem.quantity + qty, price_at_purchase: price }).eq('id', existingItem.id);
          if (error) throw error;
        } else {
          const { data: insertData, error } = await supabase.from('order_items').insert({ order_id: orderId, product_id: prodId, quantity: qty, price_at_purchase: price, product_name: selectedProduct.name, product_image: selectedProduct.image_url }).select();
          if (error) throw error;
          if (insertData && insertData[0]) insertedId = insertData[0].id;
        }
        const { error: orderError } = await supabase.from('orders').update({ total_price: newTotalPrice }).eq('id', orderId);
        if (orderError) throw orderError;
      }

      const updatedOrders = orders.map(o => {
        if (o.id === orderId) {
          let newItems = [...o.order_items];
          if (existingItem) {
            newItems = newItems.map(item => item.id === existingItem.id ? { ...item, quantity: item.quantity + qty, price_at_purchase: price } : item);
          } else {
            newItems.push({ id: insertedId, order_id: orderId, product_id: prodId, quantity: qty, price_at_purchase: price, product_name: selectedProduct.name, product_image: selectedProduct.image_url, products: { name: selectedProduct.name, image_url: selectedProduct.image_url } });
          }
          return { ...o, total_price: newTotalPrice, order_items: newItems };
        }
        return o;
      });

      setOrders(updatedOrders);
      setShowAddForm(prev => ({ ...prev, [orderId]: false }));
      setSelectedProdForOrder(prev => ({ ...prev, [orderId]: '' }));
      setAddQtyForOrder(prev => ({ ...prev, [orderId]: 1 }));
      setAddPriceForOrder(prev => ({ ...prev, [orderId]: '' }));
      setProdSearchQuery(prev => ({ ...prev, [orderId]: '' }));
      alert('تم إضافة المنتج بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء إضافة المنتج.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Add custom item to archived order
  const handleAddCustomArchivedOrderItem = async (orderId: string) => {
    const name = (customProductName[orderId] || '').trim();
    if (!name) { alert('يرجى إدخال اسم المنتج.'); return; }
    const qty = customProductQty[orderId] || 1;
    const priceStr = customProductPrice[orderId];
    const price = priceStr ? parseFloat(priceStr) : 0;
    if (qty <= 0) { alert('الكمية يجب أن تكون أكبر من الصفر.'); return; }

    setIsUpdating(true);
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const newTotalPrice = order.order_items.reduce((sum, item) => sum + (item.quantity * (item.price_at_purchase || 0)), 0) + (qty * price);
      let insertedId = 'temp-' + Date.now();

      if (isUrlConfigured) {
        const { data: insertData, error } = await supabase.from('order_items').insert({ order_id: orderId, product_id: null, quantity: qty, price_at_purchase: price, product_name: name, product_image: null }).select();
        if (error) throw error;
        if (insertData && insertData[0]) insertedId = insertData[0].id;

        const { error: orderError } = await supabase.from('orders').update({ total_price: newTotalPrice }).eq('id', orderId);
        if (orderError) throw orderError;
      }

      const updatedOrders = orders.map(o => {
        if (o.id === orderId) {
          const newItems = [...o.order_items];
          newItems.push({ id: insertedId, order_id: orderId, product_id: null, quantity: qty, price_at_purchase: price, product_name: name, product_image: null, products: null });
          return { ...o, total_price: newTotalPrice, order_items: newItems };
        }
        return o;
      });

      setOrders(updatedOrders);
      setShowCustomAddForm(prev => ({ ...prev, [orderId]: false }));
      setCustomProductName(prev => ({ ...prev, [orderId]: '' }));
      setCustomProductQty(prev => ({ ...prev, [orderId]: 1 }));
      setCustomProductPrice(prev => ({ ...prev, [orderId]: '' }));
      alert('تم إضافة المنتج المخصص بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء إضافة المنتج المخصص.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete item from archived order
  const handleDeleteArchivedOrderItem = async (orderId: string, itemId: string) => {
    const confirmAction = window.confirm('هل أنت متأكد من حذف هذا البند من الفاتورة؟');
    if (!confirmAction) return;

    setIsUpdating(true);
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const remainingItems = order.order_items.filter(item => item.id !== itemId);
      const newTotalPrice = remainingItems.reduce((sum, item) => sum + (item.quantity * (item.price_at_purchase || 0)), 0);

      if (isUrlConfigured) {
        const { error: deleteError } = await supabase.from('order_items').delete().eq('id', itemId);
        if (deleteError) throw deleteError;
        const { error: orderError } = await supabase.from('orders').update({ total_price: newTotalPrice }).eq('id', orderId);
        if (orderError) throw orderError;
      }

      const updatedOrders = orders.map(o => {
        if (o.id === orderId) {
          return { ...o, total_price: newTotalPrice, order_items: remainingItems };
        }
        return o;
      });

      setOrders(updatedOrders);
      alert('تم حذف البند وتحديث إجمالي الفاتورة بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء حذف البند.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Cancel editing
  const handleCancelEditing = () => {
    setEditingOrderId(null);
    setEditedPrices({});
    setEditedQuantities({});
    setShowAddForm({});
    setShowCustomAddForm({});
  };

  useEffect(() => {
    fetchHistoricalOrders();
    fetchAllProducts();
    fetchLastSoldPrices();
  }, []);

  // Filter logic on the fly
  const filteredOrders = orders.filter((order) => {
    const orderDate = new Date(order.created_at).toISOString().split('T')[0];
    
    let matchesDate = true;
    if (startDateFilter) {
      matchesDate = matchesDate && orderDate >= startDateFilter;
    }
    if (endDateFilter) {
      matchesDate = matchesDate && orderDate <= endDateFilter;
    }

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
    const productAggregation: { 
      [productIdOrName: string]: { productName: string, qty: number, sales: number, imageUrl?: string | null } 
    } = {};
    
    filteredOrders.forEach((order) => {
      order.order_items.forEach((item) => {
        const productName = item.products?.name || 'منتج غير معروف';
        const imgUrl = item.products?.image_url || null;
        const itemSales = item.quantity * Number(item.price_at_purchase);
        const groupKey = item.product_id || productName;
        
        if (!productAggregation[groupKey]) {
          productAggregation[groupKey] = { productName, qty: 0, sales: 0, imageUrl: imgUrl };
        }
        productAggregation[groupKey].qty += item.quantity;
        productAggregation[groupKey].sales += itemSales;
      });
    });

    return Object.keys(productAggregation).map((key) => ({
      productName: productAggregation[key].productName,
      totalQty: productAggregation[key].qty,
      totalSales: productAggregation[key].sales,
      imageUrl: productAggregation[key].imageUrl,
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
    <>
      <div className="space-y-6 print:hidden">
        {/* Offline Demo Banner */}
      {usingMockData && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
          <span>وضع العرض التجريبي للمحفوظات نشط. يمكنك اختبار الفلاتر الزمنية والبحث عن المحلات لمشاهدة تحديث المؤشرات تلقائياً.</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">إحصائيات وأرشيف المبيعات</h1>
          <p className="text-xs text-slate-500 mt-1">تتبع المبيعات الإجمالية، فحص الفواتير المؤرشفة، وفلترة طلبيات الزبائن حسب الاسم والتاريخ</p>
        </div>
        <button
          onClick={fetchHistoricalOrders}
          className="p-2.5 bg-white border border-slate-200 hover:border-slate-350 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer shadow-sm"
          title="تحديث البيانات"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Dynamic Filters Form Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          
          {/* Customer Search input */}
          <div className="space-y-1.5 lg:col-span-1">
            <label className="block text-xs font-bold text-slate-600">بحث باسم المشتري / المحل</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="ابحث عن زبون..."
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-250 outline-none rounded-xl pr-9 pl-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-right font-bold"
              />
            </div>
          </div>

          {/* Start Date Picker Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600">من تاريخ</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-3 flex items-center text-slate-400 pointer-events-none">
                <Calendar className="w-4 h-4" />
              </span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker()}
                className="w-full bg-slate-50 border border-slate-250 outline-none rounded-xl pr-9 pl-4 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-right cursor-pointer font-bold"
              />
            </div>
          </div>

          {/* End Date Picker Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600">إلى تاريخ</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-3 flex items-center text-slate-400 pointer-events-none">
                <Calendar className="w-4 h-4" />
              </span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker()}
                className="w-full bg-slate-50 border border-slate-250 outline-none rounded-xl pr-9 pl-4 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-right cursor-pointer font-bold"
              />
            </div>
          </div>

          {/* Clear Button */}
          {(startDateFilter || endDateFilter || customerFilter) ? (
            <button
              onClick={() => {
                setStartDateFilter('');
                setEndDateFilter('');
                setCustomerFilter('');
              }}
              className="h-10 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer w-full shadow-sm"
            >
              <X className="w-4.5 h-4.5" />
              <span>إعادة تعيين الفلاتر</span>
            </button>
          ) : (
            <div className="hidden lg:block h-10"></div>
          )}

        </div>
      </div>

      {/* FILTERED KPI STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div 
          className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm"
          style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        >
          <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-650 border border-emerald-200/50">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold">مبيعات الفلاتر الحالية</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{filteredRevenue.toFixed(2)} TL</h3>
          </div>
        </div>

        <div 
          className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm"
          style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        >
          <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-650 border border-emerald-200/50">
            <FileText className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold">فواتير سُلمت في النطاق</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{filteredInvoicesCount} فواتير</h3>
          </div>
        </div>

        <div 
          className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm"
          style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        >
          <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-650 border border-emerald-200/50">
            <Users className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold">زبائن مميزين مخدومين</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{filteredUniqueClientsCount} زبائن</h3>
          </div>
        </div>
      </div>

      {/* Historical Detailed Breakdown */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="bg-purple-50 p-2.5 rounded-xl text-purple-650 border border-purple-200/50">
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-md font-bold text-slate-800">سجل الفواتير الفردية المستلمة</h2>
            <p className="text-[11px] text-slate-500">تصفح الفواتير المطابقة بالتفصيل والأسعار وقت الشراء</p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-655" />
            <p className="text-xs font-bold">جاري تحميل محفوظات الفواتير...</p>
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div 
                key={order.id}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 hover:border-slate-300 transition-all shadow-xs"
              >
                {/* Order Header Info */}
                <div className={`flex items-center justify-between ${expandedOrders[order.id] || editingOrderId === order.id ? 'pb-3 border-b border-slate-200' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    {/* Collapse/Expand Arrow Button */}
                    <button
                      onClick={() => toggleOrderExpand(order.id)}
                      className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0 border border-slate-200"
                      title={expandedOrders[order.id] ? "إغلاق التفاصيل" : "عرض التفاصيل"}
                    >
                      {expandedOrders[order.id] || editingOrderId === order.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{order.customer_name}</h3>
                      <div className="flex items-center gap-2 text-[10px] text-slate-550 mt-1.5">
                        <span>التاريخ: {formatDate(order.created_at)}</span>
                        <span>•</span>
                        <span>الوقت: {formatTime(order.created_at)}</span>
                        {!expandedOrders[order.id] && editingOrderId !== order.id && (
                          <>
                            <span>•</span>
                            <span className="font-bold">{order.order_items.reduce((sum, item) => sum + item.quantity, 0)} صندوق</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="bg-white border border-slate-200 text-emerald-600 font-extrabold px-3 py-1.5 rounded-xl text-xs shadow-sm">
                    {Number(order.total_price).toFixed(2)} TL
                  </span>
                </div>

                {(expandedOrders[order.id] || editingOrderId === order.id) && (
                <>
                <div className="space-y-2">
                  {editingOrderId === order.id ? (
                    /* === EDIT MODE === */
                    <>
                      {order.order_items.map((item) => (
                        <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
                          {/* Item Name Row */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {item.product_image || item.products?.image_url ? (
                                <img 
                                  src={item.product_image || item.products?.image_url || undefined} 
                                  className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-200" 
                                  alt={item.product_name || item.products?.name || ''} 
                                />
                              ) : (
                                <ShoppingBag className="w-10 h-10 p-1.5 bg-slate-50 text-slate-400 border border-slate-200 rounded-lg shrink-0" />
                              )}
                              <span className="font-bold text-xs text-slate-800">{item.product_name || item.products?.name || 'منتج غير متوفر'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteArchivedOrderItem(order.id, item.id)}
                              disabled={isUpdating}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="حذف هذا البند"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Controls Row */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              {/* Quantity Counter */}
                              <div className="flex items-center border border-slate-250 rounded-lg overflow-hidden bg-white" dir="ltr">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentQty = editedQuantities[item.id] !== undefined ? editedQuantities[item.id] : item.quantity;
                                    if (currentQty > 1) {
                                      setEditedQuantities(prev => ({ ...prev, [item.id]: currentQty - 1 }));
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 font-extrabold cursor-pointer border-r border-slate-200 transition-colors"
                                  disabled={isUpdating}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={editedQuantities[item.id] !== undefined ? editedQuantities[item.id] : item.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    setEditedQuantities(prev => ({ ...prev, [item.id]: val }));
                                  }}
                                  className="w-8 text-center text-xs font-bold font-mono outline-none border-none py-1 text-slate-800"
                                  disabled={isUpdating}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentQty = editedQuantities[item.id] !== undefined ? editedQuantities[item.id] : item.quantity;
                                    setEditedQuantities(prev => ({ ...prev, [item.id]: currentQty + 1 }));
                                  }}
                                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 font-extrabold cursor-pointer border-l border-slate-200 transition-colors"
                                  disabled={isUpdating}
                                >
                                  +
                                </button>
                              </div>
                              <span className="text-xs font-bold text-slate-500">صندوق ×</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="السعر (TL)"
                                  value={editedPrices[item.id] !== undefined ? editedPrices[item.id] : (item.price_at_purchase !== null && item.price_at_purchase !== undefined && Number(item.price_at_purchase) > 0 ? item.price_at_purchase.toString() : '')}
                                  onFocus={() => setFocusedItemId(item.id)}
                                  onBlur={() => { setTimeout(() => setFocusedItemId(null), 200); }}
                                  onChange={(e) => {
                                    setEditedPrices(prev => ({ ...prev, [item.id]: e.target.value }));
                                  }}
                                  className="w-16 bg-white border border-slate-250 outline-none rounded-lg px-1.5 py-1 text-xs text-slate-800 focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all text-center font-bold font-mono"
                                  disabled={isUpdating}
                                />
                                {focusedItemId === item.id && lastSoldPrices[item.product_id || item.product_name || ''] !== undefined && (
                                  <button
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      const suggestedPrice = lastSoldPrices[item.product_id || item.product_name || ''];
                                      setEditedPrices(prev => ({ ...prev, [item.id]: suggestedPrice.toString() }));
                                      setFocusedItemId(null);
                                    }}
                                    className="absolute z-10 bottom-full mb-1.5 right-0 bg-[#128C7E] text-white hover:bg-[#128C7E]/95 text-[10px] font-bold py-1 px-2 rounded-lg shadow-md cursor-pointer flex items-center gap-1 whitespace-nowrap border border-emerald-500"
                                  >
                                    <span>السعر الأخير:</span>
                                    <span className="font-mono">{lastSoldPrices[item.product_id || item.product_name || '']} TL</span>
                                  </button>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-450 font-bold">TL</span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* إحصائية عدد الصناديق الإجمالي للفاتورة */}
                      <div className="flex justify-between items-center text-xs font-extrabold text-[#128C7E] bg-emerald-50/30 border border-emerald-100/80 rounded-xl px-3.5 py-2 mt-2 shadow-2xs">
                        <span>إجمالي عدد الصناديق المطلوبة:</span>
                        <span className="font-mono text-sm bg-[#128C7E]/10 px-2 py-0.5 rounded-lg">
                          {order.order_items.reduce((sum, item) => sum + (editedQuantities[item.id] !== undefined ? editedQuantities[item.id] : item.quantity), 0)} صندوق
                        </span>
                      </div>

                      {/* Add product forms */}
                      <div className="mt-3 pt-2 border-t border-dashed border-slate-200">
                        {!showAddForm[order.id] && !showCustomAddForm[order.id] ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setShowAddForm(prev => ({ ...prev, [order.id]: true }))}
                              className="w-full py-2 border border-dashed border-slate-350 hover:border-[#128C7E] rounded-xl text-xs text-slate-600 hover:text-[#128C7E] bg-white transition-all flex items-center justify-center gap-1 cursor-pointer font-bold"
                            >
                              <Plus className="w-4 h-4" />
                              <span>إضافة منتج للفاتورة</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCustomAddForm(prev => ({ ...prev, [order.id]: true }))}
                              className="w-full py-2 border border-dashed border-slate-350 hover:border-amber-500 rounded-xl text-xs text-slate-600 hover:text-amber-600 bg-white transition-all flex items-center justify-center gap-1 cursor-pointer font-bold"
                            >
                              <Plus className="w-4 h-4" />
                              <span>اضافة منتج غير موجود بالمتجر</span>
                            </button>
                          </div>
                        ) : showAddForm[order.id] ? (
                          <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 space-y-3.5 shadow-2xs relative">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-slate-700">إضافة بند جديد للفاتورة</span>
                              <button type="button" onClick={() => { setShowAddForm(prev => ({ ...prev, [order.id]: false })); setSelectedProdForOrder(prev => ({ ...prev, [order.id]: '' })); setProdSearchQuery(prev => ({ ...prev, [order.id]: '' })); }} className="p-1 hover:bg-slate-250 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            {/* Search input */}
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-bold block">بحث عن المنتج في المتجر</label>
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                                <input type="text" placeholder="اكتب اسم المنتج للتصفية..." value={prodSearchQuery[order.id] || ''} onChange={(e) => setProdSearchQuery(prev => ({ ...prev, [order.id]: e.target.value }))} className="w-full bg-white border border-slate-250 outline-none rounded-lg pr-8 pl-3 py-2 text-xs text-slate-800 placeholder-slate-400 text-right font-bold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all" />
                              </div>
                            </div>
                            {/* Product list */}
                            <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-200 rounded-lg bg-white p-1.5">
                              {allProducts.filter(p => !prodSearchQuery[order.id] || p.name.toLowerCase().includes((prodSearchQuery[order.id] || '').toLowerCase())).map((product) => (
                                <button key={product.id} type="button" onClick={() => setSelectedProdForOrder(prev => ({ ...prev, [order.id]: product.id }))} className={`w-full text-right px-2.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${selectedProdForOrder[order.id] === product.id ? 'bg-[#128C7E]/10 text-[#128C7E] border border-emerald-200' : 'hover:bg-slate-50 text-slate-700'}`}>
                                  {product.image_url ? <img src={product.image_url} className="w-8 h-8 rounded-md object-cover shrink-0 border border-slate-200" alt="" /> : <ShoppingBag className="w-8 h-8 p-1 bg-slate-50 text-slate-400 border border-slate-200 rounded-md shrink-0" />}
                                  <span>{product.name}</span>
                                </button>
                              ))}
                            </div>
                            {/* Qty & Price */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 font-bold block">الكمية</label>
                                <input type="number" min="1" value={addQtyForOrder[order.id] || 1} onChange={(e) => setAddQtyForOrder(prev => ({ ...prev, [order.id]: parseInt(e.target.value) || 1 }))} className="w-full bg-white border border-slate-250 outline-none rounded-lg px-3 py-2 text-xs text-slate-800 text-center font-bold font-mono focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 font-bold block">السعر (TL)</label>
                                <input type="number" step="0.01" min="0" placeholder="0.00" value={addPriceForOrder[order.id] || ''} onChange={(e) => setAddPriceForOrder(prev => ({ ...prev, [order.id]: e.target.value }))} className="w-full bg-white border border-slate-250 outline-none rounded-lg px-3 py-2 text-xs text-slate-800 text-center font-bold font-mono focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all" />
                              </div>
                            </div>
                            <button type="button" onClick={() => handleAddArchivedOrderItem(order.id)} disabled={isUpdating || !selectedProdForOrder[order.id]} className="w-full bg-[#128C7E] hover:bg-[#128C7E]/90 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm">
                              <Plus className="w-4 h-4" /> <span>إضافة المنتج</span>
                            </button>
                          </div>
                        ) : (
                          /* Custom product form */
                          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 space-y-3.5 shadow-2xs relative">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-amber-800">إضافة منتج مخصص (غير موجود بالمتجر)</span>
                              <button type="button" onClick={() => { setShowCustomAddForm(prev => ({ ...prev, [order.id]: false })); setCustomProductName(prev => ({ ...prev, [order.id]: '' })); }} className="p-1 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer text-amber-400 hover:text-amber-600">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-amber-700 font-bold block">اسم المنتج</label>
                              <input type="text" placeholder="أدخل اسم المنتج..." value={customProductName[order.id] || ''} onChange={(e) => setCustomProductName(prev => ({ ...prev, [order.id]: e.target.value }))} className="w-full bg-white border border-amber-250 outline-none rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 text-right font-bold focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] text-amber-700 font-bold block">الكمية</label>
                                <input type="number" min="1" value={customProductQty[order.id] || 1} onChange={(e) => setCustomProductQty(prev => ({ ...prev, [order.id]: parseInt(e.target.value) || 1 }))} className="w-full bg-white border border-amber-250 outline-none rounded-lg px-3 py-2 text-xs text-slate-800 text-center font-bold font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-amber-700 font-bold block">السعر (TL)</label>
                                <input type="number" step="0.01" min="0" placeholder="0.00" value={customProductPrice[order.id] || ''} onChange={(e) => setCustomProductPrice(prev => ({ ...prev, [order.id]: e.target.value }))} className="w-full bg-white border border-amber-250 outline-none rounded-lg px-3 py-2 text-xs text-slate-800 text-center font-bold font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all" />
                              </div>
                            </div>
                            <button type="button" onClick={() => handleAddCustomArchivedOrderItem(order.id)} disabled={isUpdating || !(customProductName[order.id] || '').trim()} className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm">
                              <Plus className="w-4 h-4" /> <span>إضافة المنتج المخصص</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Save/Cancel buttons */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
                        <button
                          onClick={() => handleSaveArchivedPrices(order.id)}
                          disabled={isUpdating}
                          className="flex-1 bg-[#128C7E] hover:bg-[#128C7E]/90 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          <span>حفظ التعديلات</span>
                        </button>
                        <button
                          onClick={handleCancelEditing}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm border border-slate-200"
                        >
                          <X className="w-4 h-4" />
                          <span>إلغاء</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    /* === READ-ONLY MODE === */
                    <>
                      {order.order_items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-xs text-slate-655">
                          <div className="flex items-center gap-2">
                            {item.product_image || item.products?.image_url ? (
                              <img 
                                src={item.product_image || item.products?.image_url || undefined} 
                                onClick={() => setActivePreviewImage(item.product_image || item.products?.image_url || null)}
                                className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-200 cursor-zoom-in hover:brightness-95 transition-all" 
                                alt={item.product_name || item.products?.name || ''} 
                              />
                            ) : (
                              <ShoppingBag className="w-14 h-14 p-2.5 bg-white text-slate-400 border border-slate-200 rounded-lg shrink-0" />
                            )}
                            <span>{item.product_name || item.products?.name || 'منتج غير متوفر'}</span>
                          </div>
                          <span className="font-semibold text-slate-800">
                            {item.price_at_purchase !== null && item.price_at_purchase !== undefined && Number(item.price_at_purchase) > 0 ? (
                              `${item.quantity} صندوق × ${Number(item.price_at_purchase).toFixed(2)} TL`
                            ) : (
                              `${item.quantity} صندوق × يحدد لاحقاً`
                            )}
                          </span>
                        </div>
                      ))}
                      
                      {/* إحصائية عدد الصناديق الإجمالي للفاتورة */}
                      <div className="flex justify-between items-center text-xs font-extrabold text-[#128C7E] bg-emerald-50/30 border border-emerald-100/80 rounded-xl px-3.5 py-2 mt-2 shadow-2xs">
                        <span>إجمالي عدد الصناديق المطلوبة:</span>
                        <span className="font-mono text-sm bg-[#128C7E]/10 px-2 py-0.5 rounded-lg">{order.order_items.reduce((sum, item) => sum + item.quantity, 0)} صندوق</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Actions Buttons for Archived Orders */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200 print:hidden">
                  {editingOrderId !== order.id && (
                    <button
                      onClick={() => {
                        setEditingOrderId(order.id);
                        setEditedPrices({});
                        setEditedQuantities({});
                      }}
                      disabled={isUpdating || (editingOrderId !== null && editingOrderId !== order.id)}
                      className="col-span-2 sm:col-auto bg-indigo-50 hover:bg-indigo-100 border border-indigo-250 text-indigo-700 font-bold px-3 py-2 sm:py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm disabled:opacity-50"
                      title="تعديل هذه الفاتورة"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>تعديل الفاتورة</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteOrder(order.id, order.customer_name)}
                    disabled={isUpdating}
                    className="col-span-2 sm:col-auto bg-red-50 hover:bg-red-100 border border-red-250 text-red-700 font-bold px-3 py-2 sm:py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm disabled:opacity-50"
                    title="حذف هذه الفاتورة نهائياً من الأرشيف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف الفاتورة</span>
                  </button>

                  <button
                    onClick={() => handleCopyInvoiceLink(order.id, order.total_price)}
                    className="col-span-1 sm:col-auto bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-600 hover:text-slate-800 font-bold px-3 py-2 sm:py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm w-full sm:w-auto"
                    title="نسخ رابط الفاتورة المباشر"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ الرابط</span>
                  </button>

                  <button
                    onClick={() => handleDownloadPDF(order)}
                    disabled={isUpdating}
                    className="col-span-1 sm:col-auto bg-teal-50 hover:bg-teal-100 border border-teal-250 text-teal-700 font-bold px-3 py-2 sm:py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm disabled:opacity-50 w-full sm:w-auto"
                    title="تحميل الفاتورة كـ PDF للواتساب"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير PDF<span className="hidden sm:inline"> للواتساب</span></span>
                  </button>

                  <button
                    onClick={() => handlePrintInvoice(order)}
                    className="col-span-1 sm:col-auto bg-blue-50 hover:bg-blue-100 border border-blue-250 text-blue-700 font-bold px-3 py-2 sm:py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm w-full sm:w-auto"
                    title="طباعة الفاتورة A4"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة A4</span>
                  </button>

                  <button
                    onClick={() => handlePrintReceipt(order)}
                    className="col-span-1 sm:col-auto bg-amber-50 hover:bg-amber-100 border border-amber-250 text-amber-700 font-bold px-3 py-2 sm:py-1.5 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm w-full sm:w-auto"
                    title="طباعة إيصال حراري 80 مم"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>إيصال 80 مم</span>
                  </button>
                </div>
                </>)}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 space-y-2">
            <FileText className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">لم نجد أي طلبيات مطابقة للبحث</h3>
            <p className="text-xs text-slate-550">جرب تعديل التاريخ أو تصفية مدخلات اسم الزبون.</p>
          </div>
        )}
      </div>

      {/* Filtered Sales Item Aggregator */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="bg-blue-50 p-2.5 rounded-xl text-blue-650 border border-blue-200/50">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-md font-bold text-slate-800">إجمالي المنتجات والسلع المباعة (في الفلاتر الحالية)</h2>
            <p className="text-[11px] text-slate-500">الكميات التراكمية المباعة من كل منتج وقيمتها المالية الإجمالية</p>
          </div>
        </div>

        {aggregatedSoldItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {aggregatedSoldItems.map((item, idx) => (
              <div 
                key={idx}
                className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between hover:border-slate-300 transition-colors shadow-xs"
              >
                <div className="flex items-center gap-3">
                  {item.imageUrl ? (
                    <img 
                      src={item.imageUrl} 
                      onClick={() => setActivePreviewImage(item.imageUrl || null)}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-200 shadow-xs cursor-zoom-in hover:brightness-95 transition-all" 
                      alt={item.productName} 
                    />
                  ) : (
                    <ShoppingBag className="w-14 h-14 p-2.5 bg-white text-slate-400 border border-slate-200 rounded-xl shrink-0" />
                  )}
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-slate-800 block">{item.productName}</span>
                    <span className="text-[10px] text-emerald-650 font-bold font-mono block">الإيراد: {item.totalSales.toFixed(2)} TL</span>
                  </div>
                </div>
                <span className="bg-white text-emerald-600 font-extrabold px-3 py-1.5 rounded-xl text-sm border border-slate-200 shadow-sm shrink-0">
                  {item.totalQty} علبة / صندوق
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">لا يوجد كميات مباعة</h3>
            <p className="text-xs text-slate-550">لا تطابق الفلاتر الحالية أي طلبيات مسجلة.</p>
          </div>
        )}
      </div>

      {/* Full-Screen Image Preview Modal */}
      {activePreviewImage && (
        <div 
          onClick={() => setActivePreviewImage(null)}
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out transition-opacity duration-300"
        >
          {/* Close Button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setActivePreviewImage(null);
            }}
            className="absolute top-6 left-6 bg-white/10 hover:bg-white/20 active:scale-95 text-white p-2.5 rounded-full border border-white/20 transition-all cursor-pointer shadow-lg z-50 flex items-center justify-center"
            title="إغلاق الصورة"
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Centered Image */}
          <div className="relative max-w-full max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img 
              src={activePreviewImage} 
              alt="Preview" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/5 select-none"
            />
          </div>
        </div>
      )}
      </div>

      {/* 3. Print-only Layout: Customer Invoice Print Sheet */}
      {activePrintOrder && (
        <div 
          id="customer-invoice-print-sheet" 
          className={`absolute left-[-9999px] top-[-9999px] w-[790px] bg-white font-sans text-right p-8 ${printType === 'invoice' ? 'print:static print:block print:w-full print:p-0' : 'print:hidden'}`} 
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
                <p>تاريخ الفاتورة: {new Date(activePrintOrder.created_at).toLocaleDateString('ar-EG', { dateStyle: 'long' })}</p>
                <p>رقم الفاتورة: #{activePrintOrder.id.substring(0, 8).toUpperCase()}</p>
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
              <span className="font-extrabold text-slate-800">{activePrintOrder.customer_name}</span>
            </div>
            <div className="text-left">
              <span className="text-slate-550 font-bold">حالة الدفع: </span>
              <span className="font-extrabold text-[#128C7E]">مسلمة / مؤرشفة</span>
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
              {activePrintOrder.order_items.map((item, idx) => {
                const price = Number(item.price_at_purchase || 0);
                const qty = item.quantity;
                const total = price * qty;
                return (
                  <tr key={item.id} className="border-b border-slate-300">
                    <td className="border border-slate-355 px-3 py-2.5 text-center font-bold font-mono">{idx + 1}</td>
                    <td className="border border-slate-355 px-3 py-2.5 font-bold text-slate-800">{item.product_name || item.products?.name || 'منتج غير معروف'}</td>
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
                {activePrintOrder.order_items.reduce((sum, item) => sum + item.quantity, 0)} صندوق
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-700 font-black text-md">المجموع الكلي النهائي:</span>
              <span className="text-xl font-black text-[#128C7E] font-mono mr-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                {Number(activePrintOrder.total_price).toFixed(2)} TL
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
      )}

      {/* Dynamic Style for 80mm Thermal Printing */}
      {(printType === 'receipt' || printType === 'aggregation_receipt') && (
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: 80mm auto;
              margin: 0mm !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 80mm !important;
              max-width: 80mm !important;
              min-width: 80mm !important;
              background-color: #fff !important;
              color: #000 !important;
              overflow: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            /* Hide EVERYTHING by default */
            body > * {
              display: none !important;
            }
            body > #__next,
            body > div[id] {
              display: block !important;
            }
            /* Reset ALL layout wrappers aggressively */
            aside, nav, header, footer,
            [class*="sidebar"], [class*="Sidebar"],
            [class*="nav-"], [class*="navigation"] {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
              overflow: hidden !important;
            }
            .min-h-screen, div.min-h-screen {
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
              min-height: 0 !important;
              background: transparent !important;
              width: 80mm !important;
              max-width: 80mm !important;
              flex-direction: column !important;
            }
            main {
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
              display: block !important;
              width: 80mm !important;
              max-width: 80mm !important;
              min-width: 80mm !important;
              flex: none !important;
            }
            main > div, main > div > div {
              max-width: 80mm !important;
              width: 80mm !important;
              padding: 0 !important;
              margin: 0 !important;
              box-sizing: border-box !important;
            }
            /* Force thermal container to fill full 80mm width */
            .thermal-container {
              display: block !important;
              width: 80mm !important;
              max-width: 80mm !important;
              min-width: 80mm !important;
              padding: 2mm !important;
              margin: 0 !important;
              box-sizing: border-box !important;
              font-size: 13px !important;
              line-height: 1.5 !important;
              overflow: visible !important;
            }
            .thermal-container table {
              width: 100% !important;
              table-layout: fixed !important;
            }
            /* Ensure all flex/grid parents flatten */
            div[class*="flex"], div[class*="grid"] {
              display: block !important;
            }
            .thermal-container div[class*="flex"] {
              display: flex !important;
            }
          }
        `}} />
      )}

      {/* 4. Print-only Layout: 80mm Thermal Receipt Print Sheet */}
      {printType === 'receipt' && activePrintOrder && (
        <div className="hidden print:block thermal-container font-sans text-right text-[13px] bg-white text-black p-3.5 w-full max-w-[80mm] mx-auto leading-relaxed" dir="rtl">
          {/* Header */}
          <div className="text-center border-b border-dashed border-black pb-2 mb-3">
            <h1 className="text-lg font-black uppercase tracking-wide">İDELBİ GIDA</h1>
            <p className="text-sm mt-0.5 font-bold">İDELBİ GIDA TİCARET L.Ş.</p>
            <p className="text-xs text-black">Esenler, İstanbul</p>
            <p className="text-xs font-black mt-2 border border-black py-0.5 px-3 inline-block rounded">إيصال مبيعات</p>
          </div>

          {/* Metadata */}
          <div className="text-xs space-y-1 mb-3 pb-2 border-b border-dashed border-black">
            <p><strong>العميل:</strong> {activePrintOrder.customer_name}</p>
            <p><strong>التاريخ:</strong> <span className="font-mono">{new Date(activePrintOrder.created_at).toLocaleDateString('ar-EG', { dateStyle: 'short' })}</span></p>
            <p><strong>رقم الفاتورة:</strong> <span className="font-mono">#{activePrintOrder.id.substring(0, 8).toUpperCase()}</span></p>
          </div>

          {/* Items Table */}
          <table className="w-full text-[13px] mb-3 border-collapse">
            <thead>
              <tr className="border-b-2 border-black text-right font-bold">
                <th className="pb-1.5 w-[55%]">الصنف</th>
                <th className="pb-1.5 text-center w-[20%]">الكمية</th>
                <th className="pb-1.5 text-left w-[25%]">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {activePrintOrder.order_items.map((item) => {
                const price = Number(item.price_at_purchase || 0);
                const qty = item.quantity;
                const total = price * qty;
                return (
                  <tr key={item.id} className="border-b border-dashed border-black/30">
                    <td className="py-2 pr-0.5">
                      <div className="font-bold text-[13px]">{item.product_name || item.products?.name || 'مادة'}</div>
                      <div className="text-[11px] text-black/70 font-mono mt-0.5">{price.toFixed(2)} TL</div>
                    </td>
                    <td className="py-2 text-center font-bold font-mono text-[13px]">{qty}</td>
                    <td className="py-2 text-left font-bold font-mono text-[13px]">{total.toFixed(2)} TL</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Summary */}
          <div className="border-t-2 border-black pt-2.5 space-y-2 text-[13px] font-bold">
            <div className="flex justify-between">
              <span>إجمالي الصناديق:</span>
              <span className="font-mono">{activePrintOrder.order_items.reduce((sum, item) => sum + item.quantity, 0)} صندوق</span>
            </div>
            <div className="flex justify-between text-sm border-t border-dashed border-black pt-2 font-black">
              <span>المجموع الكلي:</span>
              <span className="font-mono text-lg">{Number(activePrintOrder.total_price).toFixed(2)} TL</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 pt-2.5 border-t border-dashed border-black text-[11px] text-black/85">
            <p className="font-bold">شكراً لتعاملكم معنا</p>
            <p className="mt-1 font-mono text-[10px] text-black/60">İDELBİ GIDA • 80mm Thermal</p>
          </div>
        </div>
      )}
    </>
  );
}
