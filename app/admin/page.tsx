'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Users, CheckSquare, ClipboardList, TrendingUp, DollarSign, Clock, AlertCircle, Trash2, Save, Copy, X, CalendarClock, Printer, Plus, Search, Download } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

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
  status: 'pending' | 'delivered' | 'postponed';
  created_at: string;
  order_items: OrderItem[];
}

interface AggregatedItem {
  productName: string;
  totalQty: number;
  imageUrl?: string | null;
}

const formatTime = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
};

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);

  // Stats
  const [totalRevenueToday, setTotalRevenueToday] = useState(0);
  const [aggregatedItems, setAggregatedItems] = useState<AggregatedItem[]>([]);
  const [editedPrices, setEditedPrices] = useState<{[itemId: string]: string}>({});
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);

  // States for adding products, searching and printing invoices
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState<{[orderId: string]: boolean}>({});
  const [selectedProdForOrder, setSelectedProdForOrder] = useState<{[orderId: string]: string}>({});
  const [addQtyForOrder, setAddQtyForOrder] = useState<{[orderId: string]: number}>({});
  const [addPriceForOrder, setAddPriceForOrder] = useState<{[orderId: string]: string}>({});
  const [prodSearchQuery, setProdSearchQuery] = useState<{[orderId: string]: string}>({});
  const [printType, setPrintType] = useState<'aggregation' | 'invoice' | 'receipt'>('aggregation');
  const [activePrintOrder, setActivePrintOrder] = useState<Order | null>(null);


  // Seed data for admin preview
  const getMockOrders = (): Order[] => [
    {
      id: 'm-ord1',
      customer_name: 'سوبر ماركت الياسمين',
      total_price: 475.00,
      status: 'pending',
      created_at: new Date().toISOString(),
      order_items: [
        { id: 'mi-1', order_id: 'm-ord1', product_id: 'p4', quantity: 10, price_at_purchase: 25.00, products: { name: 'كوكا كولا علب 330 مل', image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=120&auto=format&fit=crop&q=60' } },
        { id: 'mi-2', order_id: 'm-ord1', product_id: 'p1', quantity: 5, price_at_purchase: 45.00, products: { name: 'بسكويت شوكولاتة أولكر 12 قطعة', image_url: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=120&auto=format&fit=crop&q=60' } }
      ]
    },
    {
      id: 'm-ord2',
      customer_name: 'بقالة النور',
      total_price: 620.00,
      status: 'pending',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      order_items: [
        { id: 'mi-3', order_id: 'm-ord2', product_id: 'p1', quantity: 10, price_at_purchase: 45.00, products: { name: 'بسكويت شوكولاتة أولكر 12 قطعة', image_url: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=120&auto=format&fit=crop&q=60' } },
        { id: 'mi-4', order_id: 'm-ord2', product_id: 'p3', quantity: 2, price_at_purchase: 85.00, products: { name: 'شاي تركي غوكسو 100 ظرف', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=120&auto=format&fit=crop&q=60' } }
      ]
    },
    {
      id: 'm-ord3',
      customer_name: 'محلات الأمل (مؤجلة)',
      total_price: 340.00,
      status: 'postponed',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      order_items: [
        { id: 'mi-5', order_id: 'm-ord3', product_id: 'p3', quantity: 4, price_at_purchase: 85.00, products: { name: 'شاي تركي غوكسو 100 ظرف', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=120&auto=format&fit=crop&q=60' } }
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

      // Fetch pending and postponed orders
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
        .in('status', ['pending', 'postponed'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Make sure order_items and products nested object satisfies our type structure
      const typedOrders: Order[] = (data || []).map((order: any) => ({
        ...order,
        order_items: (order.order_items || []).map((item: any) => ({
          ...item,
          product_name: item.product_name,
          product_image: item.product_image,
          products: item.products ? { name: item.products.name, image_url: item.products.image_url } : null
        }))
      }));

      // Fetch all products for adding products dropdown
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      if (!prodError) {
        setAllProducts(prodData || []);
      }

      setOrders(typedOrders);
      calculateStats(typedOrders);
      setUsingMockData(false);
    } catch (err) {
      console.warn('Could not fetch active orders from database. Loading preview mode.', err);
      const mockOrders = getMockOrders();
      setOrders(mockOrders);
      calculateStats(mockOrders);
      setAllProducts([
        { id: 'p1', name: 'بسكويت شوكولاتة أولكر 12 قطعة', price: 45.00, image_url: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=120&auto=format&fit=crop&q=60' },
        { id: 'p2', name: 'شوكولاتة داماك بالفستق', price: 65.00, image_url: null },
        { id: 'p3', name: 'شاي تركي غوكسو 100 ظرف', price: 85.00, image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=120&auto=format&fit=crop&q=60' },
        { id: 'p4', name: 'كوكا كولا علب 330 مل', price: 25.00, image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=120&auto=format&fit=crop&q=60' },
        { id: 'p5', name: 'صلصة طماطم تات 800 غ', price: 55.00, image_url: null },
        { id: 'p6', name: 'أرز تركي بالدو 1 كغ', price: 70.00, image_url: null },
        { id: 'p7', name: 'جبنة بيضاء بينار 500 غ', price: 110.00, image_url: null },
        { id: 'p8', name: 'لبن زبادي سوتاس 1.5 كغ', price: 75.00, image_url: null }
      ]);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const calculateStats = (activeOrders: Order[]) => {
    // Only calculate stats for active/pending orders (excluding postponed ones)
    const pendingOrders = activeOrders.filter(o => o.status === 'pending');

    // 1. Revenue
    const revenue = pendingOrders.reduce((sum, order) => sum + Number(order.total_price), 0);
    setTotalRevenueToday(revenue);

    // 2. Aggregate quantities needed for fulfillment (Layer 1)
    const productAggregation: { 
      [productIdOrName: string]: { productName: string, qty: number, imageUrl?: string | null } 
    } = {};
    
    pendingOrders.forEach((order) => {
      order.order_items.forEach((item) => {
        const productName = item.product_name || item.products?.name || 'منتج غير معروف';
        const imgUrl = item.product_image || item.products?.image_url || null;
        const groupKey = item.product_id || productName;

        if (!productAggregation[groupKey]) {
          productAggregation[groupKey] = { productName, qty: 0, imageUrl: imgUrl };
        }
        productAggregation[groupKey].qty += item.quantity;
      });
    });

    const aggregatedList: AggregatedItem[] = Object.keys(productAggregation).map((key) => ({
      productName: productAggregation[key].productName,
      totalQty: productAggregation[key].qty,
      imageUrl: productAggregation[key].imageUrl,
    }));

    setAggregatedItems(aggregatedList);
  };

  // Fulfillment Action: Mark all pending as delivered (Purchase renaming)
  const handleFulfillAll = async () => {
    const pendingOrders = orders.filter(o => o.status === 'pending');
    if (pendingOrders.length === 0) return;
    const confirmAction = window.confirm('هل أنت متأكد من شراء كافة الطلبيات المعلقة وأرشفتها؟');
    if (!confirmAction) return;

    setIsUpdating(true);
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      
      if (isUrlConfigured) {
        // Fetch all pending ids
        const pendingIds = pendingOrders.map(o => o.id);
        const { error } = await supabase
          .from('orders')
          .update({ status: 'delivered' })
          .in('id', pendingIds);

        if (error) throw error;
      } else {
        console.log('Database not connected. Bypassing state update in demo mode.');
      }

      // Success, clear active pending view, keeping postponed orders untouched
      const updatedOrders = orders.filter(o => o.status !== 'pending');
      setOrders(updatedOrders);
      calculateStats(updatedOrders);
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

  const handleSavePrices = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    setIsUpdating(true);
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      
      const itemsToUpdate = order.order_items.map(item => {
        const newPriceStr = editedPrices[item.id];
        const newPrice = newPriceStr !== undefined && newPriceStr !== '' ? parseFloat(newPriceStr) : (item.price_at_purchase || 0);
        return {
          id: item.id,
          order_id: orderId,
          product_id: item.product_id,
          quantity: item.quantity,
          price_at_purchase: newPrice
        };
      });

      const newTotalPrice = itemsToUpdate.reduce((sum, item) => sum + (item.quantity * item.price_at_purchase), 0);

      if (isUrlConfigured) {
        // 1. Update items
        const { error: itemsError } = await supabase
          .from('order_items')
          .upsert(itemsToUpdate);

        if (itemsError) throw itemsError;

        // 2. Update order total
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
              return {
                ...item,
                price_at_purchase: newPrice
              };
            })
          };
        }
        return o;
      });

      setOrders(updatedOrders);
      calculateStats(updatedOrders);
      alert('تم حفظ الأسعار وتحديث إجمالي الفاتورة بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ أسعار الفاتورة.');
    } finally {
      setIsUpdating(false);
    }
  };



  // DB Mutation: Add item to order
  const handleAddOrderItem = async (orderId: string) => {
    const prodId = selectedProdForOrder[orderId];
    if (!prodId) {
      alert('يرجى اختيار منتج أولاً.');
      return;
    }
    const qty = addQtyForOrder[orderId] || 1;
    const priceStr = addPriceForOrder[orderId];
    const price = priceStr ? parseFloat(priceStr) : 0;
    if (qty <= 0) {
      alert('الكمية يجب أن تكون أكبر من الصفر.');
      return;
    }

    const selectedProduct = allProducts.find(p => p.id === prodId);
    if (!selectedProduct) return;

    setIsUpdating(true);
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      // Check if product is already in the order
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
          const { error: updateError } = await supabase
            .from('order_items')
            .update({ 
              quantity: existingItem.quantity + qty,
              price_at_purchase: price
            })
            .eq('id', existingItem.id);

          if (updateError) throw updateError;
        } else {
          const { data: insertData, error: insertError } = await supabase
            .from('order_items')
            .insert({
              order_id: orderId,
              product_id: prodId,
              quantity: qty,
              price_at_purchase: price,
              product_name: selectedProduct.name,
              product_image: selectedProduct.image_url
            })
            .select();

          if (insertError) throw insertError;
          if (insertData && insertData[0]) {
            insertedId = insertData[0].id;
          }
        }

        // Update orders.total_price
        const { error: orderError } = await supabase
          .from('orders')
          .update({ total_price: newTotalPrice })
          .eq('id', orderId);
        if (orderError) throw orderError;
      }

      // Local state update
      const updatedOrders = orders.map(o => {
        if (o.id === orderId) {
          let newItems = [...o.order_items];
          if (existingItem) {
            newItems = newItems.map(item => {
              if (item.id === existingItem.id) {
                return {
                  ...item,
                  quantity: item.quantity + qty,
                  price_at_purchase: price
                };
              }
              return item;
            });
          } else {
            newItems.push({
              id: insertedId,
              order_id: orderId,
              product_id: prodId,
              quantity: qty,
              price_at_purchase: price,
              product_name: selectedProduct.name,
              product_image: selectedProduct.image_url,
              products: {
                name: selectedProduct.name,
                image_url: selectedProduct.image_url
              }
            });
          }
          return {
            ...o,
            total_price: newTotalPrice,
            order_items: newItems
          };
        }
        return o;
      });

      setOrders(updatedOrders);
      calculateStats(updatedOrders);

      // Clear add form states for this order
      setShowAddForm(prev => ({ ...prev, [orderId]: false }));
      setSelectedProdForOrder(prev => ({ ...prev, [orderId]: '' }));
      setAddQtyForOrder(prev => ({ ...prev, [orderId]: 1 }));
      setAddPriceForOrder(prev => ({ ...prev, [orderId]: '' }));
      setProdSearchQuery(prev => ({ ...prev, [orderId]: '' }));

      alert('تم إضافة المنتج بنجاح وتحديث إجمالي الفاتورة!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء إضافة المنتج.');
    } finally {
      setIsUpdating(false);
    }
  };

  // DB Mutation: Delete item from order
  const handleDeleteOrderItem = async (orderId: string, itemId: string) => {
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
        // Delete the item
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('id', itemId);

        if (deleteError) throw deleteError;

        // Update orders.total_price
        const { error: orderError } = await supabase
          .from('orders')
          .update({ total_price: newTotalPrice })
          .eq('id', orderId);
        if (orderError) throw orderError;
      }

      // Local state update
      const updatedOrders = orders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            total_price: newTotalPrice,
            order_items: remainingItems
          };
        }
        return o;
      });

      setOrders(updatedOrders);
      calculateStats(updatedOrders);
      alert('تم حذف البند وتحديث إجمالي الفاتورة بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء حذف البند.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper to generate and download client-side PDF for WhatsApp sharing
  const handleDownloadPDF = async (order: Order) => {
    setIsUpdating(true);
    try {
      // Set the active print order so the print sheet is rendered in the DOM
      setPrintType('invoice');
      setActivePrintOrder(order);

      // Wait for DOM to render/update the invoice print container
      await new Promise((resolve) => setTimeout(resolve, 400));

      const input = document.getElementById('customer-invoice-print-sheet');
      if (!input) {
        alert('لم يتم العثور على هيكل الفاتورة للتحويل.');
        return;
      }

      const canvas = await html2canvas(input, {
        scale: 2, // higher resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Calculate A4 dimensions (210mm x 297mm)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
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

  // Helper functions for print triggers
  const handlePrintInvoice = (order: Order) => {
    setPrintType('invoice');
    setActivePrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintReceipt = (order: Order) => {
    setPrintType('receipt');
    setActivePrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintAggregation = () => {
    setPrintType('aggregation');
    setActivePrintOrder(null);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const getFilteredProducts = (orderId: string) => {
    const query = (prodSearchQuery[orderId] || '').trim().toLowerCase();
    if (!query) return allProducts;
    return allProducts.filter(p => p.name.toLowerCase().includes(query));
  };

  const handlePostponeOrder = async (orderId: string, currentStatus: 'pending' | 'postponed') => {
    const newStatus: 'pending' | 'postponed' = currentStatus === 'pending' ? 'postponed' : 'pending';
    const actionText = newStatus === 'postponed' ? 'تأجيل' : 'تنشيط';
    const confirmAction = window.confirm(`هل أنت متأكد من ${actionText} هذه الطلبية؟`);
    if (!confirmAction) return;

    setIsUpdating(true);
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      
      if (isUrlConfigured) {
        const { error } = await supabase
          .from('orders')
          .update({ status: newStatus })
          .eq('id', orderId);

        if (error) throw error;
      } else {
        console.log('Database not connected. Bypassing state update in demo mode.');
      }

      // Update local state
      const updatedOrders = orders.map(o => {
        if (o.id === orderId) {
          return { ...o, status: newStatus };
        }
        return o;
      });

      setOrders(updatedOrders);
      calculateStats(updatedOrders);
      alert(`تم ${actionText} الطلبية بنجاح!`);
    } catch (err: any) {
      console.error(err);
      alert(`حدث خطأ أثناء ${actionText} الطلبية.`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyInvoiceLink = (orderId: string, totalPrice: number) => {
    if (totalPrice <= 0) {
      alert('يرجى حفظ وتسعير الفاتورة أولاً قبل نسخ الرابط.');
      return;
    }
    const invoiceUrl = `${window.location.origin}/invoice/${orderId}`;
    navigator.clipboard.writeText(invoiceUrl);
    alert('تم نسخ رابط الفاتورة المباشر إلى الحافظة بنجاح!');
  };

  const activeOrdersList = orders.filter(o => o.status === 'pending');
  const postponedOrdersList = orders.filter(o => o.status === 'postponed');

  return (
    <>
      <div className="space-y-6 print:hidden">
      {/* Top Warning for offline test mode */}
      {usingMockData && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
          <span>وضع معاينة لوحة التحكم نشط. لتفعيل لوحة التحكم الحية، يرجى إدخال إعدادات Supabase في ملف .env.local</span>
        </div>
      )}

      {/* Overview Analytics Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div 
          className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm"
          style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        >
          <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-600 border border-emerald-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold">زبائن اليوم المعلقين</p>
            <h3 className="text-2xl font-black text-slate-850 mt-1">{orders.filter(o => o.status === 'pending').length} زبائن</h3>
          </div>
        </div>

        <div 
          className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm"
          style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        >
          <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-600 border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold">إجمالي مبيعات اليوم المعلقة</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{totalRevenueToday.toFixed(2)} TL</h3>
          </div>
        </div>

        <div 
          className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm"
          style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        >
          <div className="bg-emerald-500/10 p-4 rounded-2xl text-emerald-600 border border-emerald-500/20">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold">أنواع السلع المطلوبة</p>
            <h3 className="text-2xl font-black text-slate-850 mt-1">{aggregatedItems.length} سلع مختلفة</h3>
          </div>
        </div>
      </div>

      {/* Layer 2: Customer Order Breakdown */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="bg-purple-500/10 p-2.5 rounded-xl text-purple-600 border border-purple-500/20">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-md font-bold text-slate-800">كشف الفواتير والزبائن بالتفصيل</h2>
            <p className="text-[11px] text-slate-500">قائمة بالفواتير الفردية المستلمة وتفاصيل طلب كل زبون</p>
          </div>
        </div>

        {activeOrdersList.length > 0 ? (
          <div className="space-y-4">
            {activeOrdersList.map((order) => (
              <div 
                key={order.id}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 hover:border-slate-300 transition-all"
              >
                {/* Order Header Info */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex justify-between items-start w-full sm:w-auto">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{order.customer_name}</h3>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>ساعة الاستلام: {formatTime(order.created_at)}</span>
                      </div>
                    </div>
                    {/* On mobile, show the price badge here to save space on the button group */}
                    <span className="sm:hidden bg-white border border-slate-200 text-emerald-600 font-extrabold px-2.5 py-1.5 rounded-xl text-xs self-center">
                      {Number(order.total_price).toFixed(2)} TL
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-end">
                    {/* On desktop, show the price badge in the group */}
                    <span className="hidden sm:inline-block bg-white border border-slate-200 text-emerald-600 font-extrabold px-3 py-1.5 rounded-xl text-xs">
                      {Number(order.total_price).toFixed(2)} TL
                    </span>
                    <button
                      onClick={() => handlePostponeOrder(order.id, 'pending')}
                      disabled={isUpdating}
                      className="bg-amber-50 hover:bg-amber-100 border border-amber-250 text-amber-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                      title="تأجيل الطلبية لوقت لاحق"
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>تأجيل</span>
                    </button>
                    <button
                      onClick={() => handleFulfillOrder(order.id, order.customer_name)}
                      disabled={isUpdating}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-450 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                      title="تحديد كـ تم التسليم ونقل للأرشيف"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>تم التسليم</span>
                    </button>
                    <button
                      onClick={() => handleCancelOrder(order.id, order.customer_name)}
                      disabled={isUpdating}
                      className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 hover:text-rose-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
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
                    <div key={item.id} className="flex justify-between items-center text-xs text-slate-600">
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
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-bold text-slate-500">{item.quantity} صندوق ×</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="السعر (TL)"
                          value={editedPrices[item.id] !== undefined ? editedPrices[item.id] : (item.price_at_purchase !== null && item.price_at_purchase !== undefined && Number(item.price_at_purchase) > 0 ? item.price_at_purchase.toString() : '')}
                          onChange={(e) => {
                            setEditedPrices(prev => ({
                              ...prev,
                              [item.id]: e.target.value
                            }));
                          }}
                          className="w-20 bg-white border border-slate-250 outline-none rounded-lg px-2 py-1 text-xs text-slate-800 focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all text-center font-bold"
                          disabled={isUpdating}
                        />
                        <span className="text-[10px] text-slate-450 font-bold">TL</span>
                        
                        <button
                          type="button"
                          onClick={() => handleDeleteOrderItem(order.id, item.id)}
                          disabled={isUpdating}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 ml-1"
                          title="حذف هذا البند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* إحصائية عدد الصناديق الإجمالي للفاتورة */}
                  <div className="flex justify-between items-center text-xs font-extrabold text-[#128C7E] bg-emerald-50/30 border border-emerald-100/80 rounded-xl px-3.5 py-2 mt-2 shadow-2xs">
                    <span>إجمالي عدد الصناديق المطلوبة:</span>
                    <span className="font-mono text-sm bg-[#128C7E]/10 px-2 py-0.5 rounded-lg">{order.order_items.reduce((sum, item) => sum + item.quantity, 0)} صندوق</span>
                  </div>

                  {/* زر ونموذج إضافة منتج للفاتورة */}
                  <div className="mt-3 pt-2 border-t border-dashed border-slate-200">
                    {!showAddForm[order.id] ? (
                      <button
                        type="button"
                        onClick={() => setShowAddForm(prev => ({ ...prev, [order.id]: true }))}
                        className="w-full py-2 border border-dashed border-slate-350 hover:border-[#128C7E] rounded-xl text-xs text-slate-600 hover:text-[#128C7E] bg-white transition-all flex items-center justify-center gap-1 cursor-pointer font-bold"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة منتج للفاتورة</span>
                      </button>
                    ) : (
                      <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 space-y-3.5 shadow-2xs relative">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-700">إضافة بند جديد للفاتورة</span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddForm(prev => ({ ...prev, [order.id]: false }));
                              setSelectedProdForOrder(prev => ({ ...prev, [order.id]: '' }));
                              setAddQtyForOrder(prev => ({ ...prev, [order.id]: 1 }));
                              setAddPriceForOrder(prev => ({ ...prev, [order.id]: '' }));
                              setProdSearchQuery(prev => ({ ...prev, [order.id]: '' }));
                            }}
                            className="p-1 hover:bg-slate-250 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* البحث عن المنتج */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold block">بحث عن المنتج في المتجر</label>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="اكتب اسم المنتج للتصفية..."
                              value={prodSearchQuery[order.id] || ''}
                              onChange={(e) => {
                                setProdSearchQuery(prev => ({ ...prev, [order.id]: e.target.value }));
                              }}
                              className="w-full bg-white border border-slate-250 outline-none rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-850 focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all font-bold"
                            />
                          </div>
                        </div>

                        {/* اختيار المنتج من المنسدلة */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold block">اختر المنتج من القائمة</label>
                          <select
                            value={selectedProdForOrder[order.id] || ''}
                            onChange={(e) => {
                              const pId = e.target.value;
                              setSelectedProdForOrder(prev => ({ ...prev, [order.id]: pId }));
                              const prod = allProducts.find(p => p.id === pId);
                              if (prod) {
                                setAddPriceForOrder(prev => ({ ...prev, [order.id]: (prod.price || 0).toString() }));
                              }
                            }}
                            className="w-full bg-white border border-slate-250 outline-none rounded-xl px-2.5 py-1.5 text-xs text-slate-850 focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all font-bold"
                          >
                            <option value="">-- اختر المنتج --</option>
                            {getFilteredProducts(order.id).map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.price ? `(${p.price} TL)` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* الكمية والسعر */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 font-bold block">الكمية (صناديق)</label>
                            <input
                              type="number"
                              min="1"
                              value={addQtyForOrder[order.id] || 1}
                              onChange={(e) => {
                                setAddQtyForOrder(prev => ({ ...prev, [order.id]: parseInt(e.target.value) || 1 }));
                              }}
                              className="w-full bg-white border border-slate-250 outline-none rounded-xl px-2.5 py-1.5 text-xs text-slate-850 focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all text-center font-bold font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 font-bold block">السعر للصندوق (TL)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={addPriceForOrder[order.id] || ''}
                              placeholder="مثال: 45.00"
                              onChange={(e) => {
                                setAddPriceForOrder(prev => ({ ...prev, [order.id]: e.target.value }));
                              }}
                              className="w-full bg-white border border-slate-250 outline-none rounded-xl px-2.5 py-1.5 text-xs text-slate-850 focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all text-center font-bold font-mono"
                            />
                          </div>
                        </div>

                        {/* زري الإضافة والإلغاء */}
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleAddOrderItem(order.id)}
                            disabled={isUpdating || !selectedProdForOrder[order.id]}
                            className="flex-1 bg-[#128C7E] hover:bg-[#128C7E]/95 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
                          >
                            إضافة البند
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddForm(prev => ({ ...prev, [order.id]: false }));
                              setSelectedProdForOrder(prev => ({ ...prev, [order.id]: '' }));
                              setAddQtyForOrder(prev => ({ ...prev, [order.id]: 1 }));
                              setAddPriceForOrder(prev => ({ ...prev, [order.id]: '' }));
                              setProdSearchQuery(prev => ({ ...prev, [order.id]: '' }));
                            }}
                            className="flex-1 bg-white hover:bg-slate-200 border border-slate-350 text-slate-650 font-bold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 mt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSavePrices(order.id)}
                      disabled={isUpdating}
                      className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                      title="حفظ الأسعار المدخلة وتحديث الإجمالي"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>حفظ الأسعار</span>
                    </button>
                    
                    <button
                      onClick={() => handleCopyInvoiceLink(order.id, order.total_price)}
                      className="bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-600 hover:text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                      title="نسخ رابط الفاتورة لمشاركته بأي طريقة أخرى"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ الرابط</span>
                    </button>

                    <button
                      onClick={() => handlePrintInvoice(order)}
                      className="bg-blue-50 hover:bg-blue-100 border border-blue-250 text-blue-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                      title="طباعة الفاتورة A4"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة A4</span>
                    </button>

                    <button
                      onClick={() => handlePrintReceipt(order)}
                      className="bg-amber-50 hover:bg-amber-100 border border-amber-250 text-amber-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                      title="طباعة إيصال حراري 58 مم"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>إيصال 58 مم</span>
                    </button>

                    <button
                      onClick={() => handleDownloadPDF(order)}
                      disabled={isUpdating}
                      className="bg-teal-50 hover:bg-teal-100 border border-teal-250 text-teal-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm disabled:opacity-50"
                      title="تحميل الفاتورة كـ PDF لمشاركتها على واتساب"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تصدير PDF للواتساب</span>
                    </button>
                  </div>

                  <span className="text-[10px] text-slate-400 font-medium">
                    * قم بحفظ الأسعار أولاً لتفعيل المشاركة والطباعة.
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 space-y-2">
            <ClipboardList className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">لا يوجد فواتير فردية نشطة</h3>
            <p className="text-xs text-slate-500">سيتم سرد الفواتير فور إرسالها من الزبائن في المتجر العام.</p>
          </div>
        )}
      </div>

      {/* Layer 1: Global Daily Fulfillment Stats */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-600 border border-blue-500/20">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-md font-bold text-slate-800">تجميع الطلبيات الإجمالي لليوم</h2>
              <p className="text-[11px] text-slate-505">إجمالي الكميات والسلع اللازم تجهيزها من المستودع لتلبية كافة الزبائن</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {aggregatedItems.length > 0 && (
              <button
                onClick={handlePrintAggregation}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
                title="طباعة ورقة تجميع السلع للمستودع"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>طباعة التجميع</span>
              </button>
            )}

            {activeOrdersList.length > 0 && (
              <button
                onClick={handleFulfillAll}
                disabled={isUpdating}
                className="bg-[#128C7E] hover:bg-[#128C7E]/90 disabled:bg-slate-100 disabled:text-slate-400 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <CheckSquare className="w-4 h-4" />
                <span>{isUpdating ? 'جاري التحديث...' : 'تم الشراء'}</span>
              </button>
            )}
          </div>
        </div>

        {aggregatedItems.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {aggregatedItems.map((item, idx) => (
                <div 
                  key={idx}
                  className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex items-center justify-between hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? (
                      <img 
                        src={item.imageUrl} 
                        onClick={() => setActivePreviewImage(item.imageUrl || null)}
                        className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-205 cursor-zoom-in hover:brightness-95 transition-all" 
                        alt={item.productName} 
                      />
                    ) : (
                      <ShoppingBag className="w-14 h-14 p-2.5 bg-white text-slate-400 border border-slate-200 rounded-xl shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-slate-700">{item.productName}</span>
                  </div>
                  <span className="bg-white text-emerald-600 font-extrabold px-3 py-1.5 rounded-xl text-sm border border-slate-200 shrink-0">
                    {item.totalQty} علبة / صندوق
                  </span>
                </div>
              ))}
            </div>
            
            {/* إجمالي عدد الصناديق لتجميع الطلبيات الإجمالي */}
            <div className="flex justify-between items-center text-xs font-extrabold text-[#128C7E] bg-emerald-50/30 border border-emerald-100/80 rounded-xl px-4 py-3 shadow-2xs">
              <span>إجمالي عدد الصناديق المطلوب تجهيزها اليوم:</span>
              <span className="font-mono text-sm bg-[#128C7E]/10 px-2.5 py-0.5 rounded-lg text-emerald-700">
                {aggregatedItems.reduce((sum, item) => sum + item.totalQty, 0)} صندوق
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 space-y-2">
            <CheckSquare className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">كل السلع مجهزة وسُلمت للزبائن</h3>
            <p className="text-xs text-slate-500">لا يوجد منتجات معلقة تحتاج للتجهيز من المستودع حالياً.</p>
          </div>
        )}
      </div>

      {/* Postponed Orders Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="bg-amber-500/10 p-2.5 rounded-xl text-amber-600 border border-amber-500/20">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-md font-bold text-slate-800">الطلبيات المؤجلة</h2>
            <p className="text-[11px] text-slate-500">قائمة بالفواتير التي تم تأجيلها لوقت لاحق لتسليمها يدوياً</p>
          </div>
        </div>

        {postponedOrdersList.length > 0 ? (
          <div className="space-y-4">
            {postponedOrdersList.map((order) => (
              <div 
                key={order.id}
                className="bg-amber-50/10 border border-amber-200/50 rounded-2xl p-5 space-y-4 hover:border-amber-300/60 transition-all"
              >
                {/* Order Header Info */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-amber-100/50">
                  <div className="flex justify-between items-start w-full sm:w-auto">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{order.customer_name}</h3>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>ساعة الاستلام: {formatTime(order.created_at)}</span>
                      </div>
                    </div>
                    {/* On mobile, show the price badge here to save space on the button group */}
                    <span className="sm:hidden bg-white border border-slate-200 text-emerald-600 font-extrabold px-2.5 py-1.5 rounded-xl text-xs self-center">
                      {Number(order.total_price).toFixed(2)} TL
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-end">
                    {/* On desktop, show the price badge in the group */}
                    <span className="hidden sm:inline-block bg-white border border-slate-200 text-emerald-600 font-extrabold px-3 py-1.5 rounded-xl text-xs">
                      {Number(order.total_price).toFixed(2)} TL
                    </span>
                    <button
                      onClick={() => handlePostponeOrder(order.id, 'postponed')}
                      disabled={isUpdating}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-450 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                      title="إعادة تنشيط الطلبية ونقلها للنشطة"
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>تنشيط</span>
                    </button>
                    <button
                      onClick={() => handleFulfillOrder(order.id, order.customer_name)}
                      disabled={isUpdating}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-450 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
                      title="تحديد كـ تم التسليم ونقل للأرشيف"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>تم التسليم</span>
                    </button>
                    <button
                      onClick={() => handleCancelOrder(order.id, order.customer_name)}
                      disabled={isUpdating}
                      className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 hover:text-rose-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
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
                    <div key={item.id} className="flex justify-between items-center text-xs text-slate-600">
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
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-bold text-slate-500">{item.quantity} صندوق ×</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="السعر (TL)"
                          value={editedPrices[item.id] !== undefined ? editedPrices[item.id] : (item.price_at_purchase !== null && item.price_at_purchase !== undefined && Number(item.price_at_purchase) > 0 ? item.price_at_purchase.toString() : '')}
                          onChange={(e) => {
                            setEditedPrices(prev => ({
                              ...prev,
                              [item.id]: e.target.value
                            }));
                          }}
                          className="w-20 bg-white border border-slate-250 outline-none rounded-lg px-2 py-1 text-xs text-slate-800 focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all text-center font-bold"
                          disabled={isUpdating}
                        />
                        <span className="text-[10px] text-slate-450 font-bold">TL</span>
                        
                        <button
                          type="button"
                          onClick={() => handleDeleteOrderItem(order.id, item.id)}
                          disabled={isUpdating}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 ml-1"
                          title="حذف هذا البند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* إحصائية عدد الصناديق الإجمالي للفاتورة */}
                  <div className="flex justify-between items-center text-xs font-extrabold text-[#128C7E] bg-emerald-50/30 border border-emerald-100/80 rounded-xl px-3.5 py-2 mt-2 shadow-2xs">
                    <span>إجمالي عدد الصناديق المطلوبة:</span>
                    <span className="font-mono text-sm bg-[#128C7E]/10 px-2 py-0.5 rounded-lg">{order.order_items.reduce((sum, item) => sum + item.quantity, 0)} صندوق</span>
                  </div>

                  {/* زر ونموذج إضافة منتج للفاتورة */}
                  <div className="mt-3 pt-2 border-t border-dashed border-slate-200">
                    {!showAddForm[order.id] ? (
                      <button
                        type="button"
                        onClick={() => setShowAddForm(prev => ({ ...prev, [order.id]: true }))}
                        className="w-full py-2 border border-dashed border-slate-350 hover:border-[#128C7E] rounded-xl text-xs text-slate-600 hover:text-[#128C7E] bg-white transition-all flex items-center justify-center gap-1 cursor-pointer font-bold"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة منتج للفاتورة</span>
                      </button>
                    ) : (
                      <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 space-y-3.5 shadow-2xs relative">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-700">إضافة بند جديد للفاتورة</span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddForm(prev => ({ ...prev, [order.id]: false }));
                              setSelectedProdForOrder(prev => ({ ...prev, [order.id]: '' }));
                              setAddQtyForOrder(prev => ({ ...prev, [order.id]: 1 }));
                              setAddPriceForOrder(prev => ({ ...prev, [order.id]: '' }));
                              setProdSearchQuery(prev => ({ ...prev, [order.id]: '' }));
                            }}
                            className="p-1 hover:bg-slate-250 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-slate-650"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* البحث عن المنتج */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold block">بحث عن المنتج في المتجر</label>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="اكتب اسم المنتج للتصفية..."
                              value={prodSearchQuery[order.id] || ''}
                              onChange={(e) => {
                                setProdSearchQuery(prev => ({ ...prev, [order.id]: e.target.value }));
                              }}
                              className="w-full bg-white border border-slate-250 outline-none rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-850 focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all font-bold"
                            />
                          </div>
                        </div>

                        {/* اختيار المنتج من المنسدلة */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold block">اختر المنتج من القائمة</label>
                          <select
                            value={selectedProdForOrder[order.id] || ''}
                            onChange={(e) => {
                              const pId = e.target.value;
                              setSelectedProdForOrder(prev => ({ ...prev, [order.id]: pId }));
                              const prod = allProducts.find(p => p.id === pId);
                              if (prod) {
                                setAddPriceForOrder(prev => ({ ...prev, [order.id]: (prod.price || 0).toString() }));
                              }
                            }}
                            className="w-full bg-white border border-slate-250 outline-none rounded-xl px-2.5 py-1.5 text-xs text-slate-850 focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all font-bold"
                          >
                            <option value="">-- اختر المنتج --</option>
                            {getFilteredProducts(order.id).map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.price ? `(${p.price} TL)` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* الكمية والسعر */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 font-bold block">الكمية (صناديق)</label>
                            <input
                              type="number"
                              min="1"
                              value={addQtyForOrder[order.id] || 1}
                              onChange={(e) => {
                                setAddQtyForOrder(prev => ({ ...prev, [order.id]: parseInt(e.target.value) || 1 }));
                              }}
                              className="w-full bg-white border border-slate-250 outline-none rounded-xl px-2.5 py-1.5 text-xs text-slate-850 focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all text-center font-bold font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 font-bold block">السعر للصندوق (TL)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={addPriceForOrder[order.id] || ''}
                              placeholder="مثال: 45.00"
                              onChange={(e) => {
                                setAddPriceForOrder(prev => ({ ...prev, [order.id]: e.target.value }));
                              }}
                              className="w-full bg-white border border-slate-250 outline-none rounded-xl px-2.5 py-1.5 text-xs text-slate-850 focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all text-center font-bold font-mono"
                            />
                          </div>
                        </div>

                        {/* زري الإضافة والإلغاء */}
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleAddOrderItem(order.id)}
                            disabled={isUpdating || !selectedProdForOrder[order.id]}
                            className="flex-1 bg-[#128C7E] hover:bg-[#128C7E]/95 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
                          >
                            إضافة البند
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddForm(prev => ({ ...prev, [order.id]: false }));
                              setSelectedProdForOrder(prev => ({ ...prev, [order.id]: '' }));
                              setAddQtyForOrder(prev => ({ ...prev, [order.id]: 1 }));
                              setAddPriceForOrder(prev => ({ ...prev, [order.id]: '' }));
                              setProdSearchQuery(prev => ({ ...prev, [order.id]: '' }));
                            }}
                            className="flex-1 bg-white hover:bg-slate-200 border border-slate-350 text-slate-650 font-bold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 mt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSavePrices(order.id)}
                      disabled={isUpdating}
                      className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                      title="حفظ الأسعار المدخلة وتحديث الإجمالي"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>حفظ الأسعار</span>
                    </button>
                    
                    <button
                      onClick={() => handleCopyInvoiceLink(order.id, order.total_price)}
                      className="bg-slate-50 hover:bg-slate-100 border border-slate-250 text-slate-600 hover:text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                      title="نسخ رابط الفاتورة لمشاركته بأي طريقة أخرى"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ الرابط</span>
                    </button>

                    <button
                      onClick={() => handlePrintInvoice(order)}
                      className="bg-blue-50 hover:bg-blue-100 border border-blue-250 text-blue-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                      title="طباعة الفاتورة A4"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة A4</span>
                    </button>

                    <button
                      onClick={() => handlePrintReceipt(order)}
                      className="bg-amber-50 hover:bg-amber-100 border border-amber-250 text-amber-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                      title="طباعة إيصال حراري 58 مم"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>إيصال 58 مم</span>
                    </button>

                    <button
                      onClick={() => handleDownloadPDF(order)}
                      disabled={isUpdating}
                      className="bg-teal-50 hover:bg-teal-100 border border-teal-250 text-teal-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm disabled:opacity-50"
                      title="تحميل الفاتورة كـ PDF لمشاركتها على واتساب"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تصدير PDF للواتساب</span>
                    </button>
                  </div>

                  <span className="text-[10px] text-slate-400 font-medium">
                    * يمكنك تنشيط الطلبية لتعود لقائمة التوزيع الفعالة.
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 space-y-2">
            <CalendarClock className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">لا يوجد طلبات مؤجلة حالياً</h3>
            <p className="text-xs text-slate-500">الطلبيات المؤجلة تظهر هنا لتنظيم العمل اليومي.</p>
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

      {/* 2. Print-only Layout: Daily Aggregation Print Sheet */}
      {printType === 'aggregation' && (
        <div className="hidden print:block font-sans text-right" dir="rtl">
          {/* Brand & Sheet Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center sm:text-right">
            <h1 className="text-2xl font-black text-slate-800">idelbi gida | إدلب غذائيات</h1>
            <p className="text-xs text-slate-500 font-bold mt-1">جدول تجميع الطلبيات الإجمالي اليومي للمستودع</p>
            <p className="text-[10px] text-slate-400 font-bold mt-1">تاريخ الطباعة: {new Date().toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' })}</p>
          </div>

          {/* Aggregated Table */}
          <table className="w-full border-collapse border border-slate-300 text-sm">
            <thead>
              <tr className="bg-slate-150">
                <th className="border border-slate-300 px-4 py-2 text-right font-black">#</th>
                <th className="border border-slate-300 px-4 py-2 text-right font-black">اسم المنتج</th>
                <th className="border border-slate-300 px-4 py-2 text-center font-black">الكمية المطلوبة</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="border border-slate-300 px-4 py-2.5 font-bold font-mono">{idx + 1}</td>
                  <td className="border border-slate-300 px-4 py-2.5 font-bold">{item.productName}</td>
                  <td className="border border-slate-300 px-4 py-2.5 text-center font-black text-slate-800 text-base">{item.totalQty} علبة / صندوق</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Aggregate Boxes Total */}
          <div className="mt-6 border-t-2 border-slate-900 pt-4 flex justify-between items-center font-black text-lg">
            <span>إجمالي عدد الصناديق المطلوب تجهيزها:</span>
            <span>{aggregatedItems.reduce((sum, item) => sum + item.totalQty, 0)} صندوق</span>
          </div>

          <div className="mt-12 text-center text-[10px] text-slate-400 border-t border-slate-200 pt-4 font-bold">
            * تم توليد هذه الصفحة تلقائياً لتسهيل تجميع البضائع من الرفوف • idelbi gıda
          </div>
        </div>
      )}

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

      {/* 4. Print-only Layout: 58mm Thermal Receipt Print Sheet */}
      {printType === 'receipt' && activePrintOrder && (
        <div className="hidden print:block font-mono text-right text-xs bg-white text-black p-1 w-[58mm] mx-auto leading-relaxed" dir="rtl">
          {/* Header */}
          <div className="text-center border-b border-dashed border-black pb-2 mb-2">
            <h1 className="text-sm font-bold uppercase">İDELBİ GIDA</h1>
            <p className="text-[9px] mt-0.5 font-bold">İDELBİ GIDA TİCARET L.Ş.</p>
            <p className="text-[8px] text-slate-600">Esenler, İstanbul</p>
            <p className="text-[9px] font-bold mt-1 border border-black py-0.5 px-2 inline-block rounded">إيصال مبيعات</p>
          </div>

          {/* Metadata */}
          <div className="text-[9px] space-y-0.5 mb-2 pb-1.5 border-b border-dashed border-black">
            <p><strong>العميل:</strong> {activePrintOrder.customer_name}</p>
            <p><strong>التاريخ:</strong> {new Date(activePrintOrder.created_at).toLocaleDateString('ar-EG', { dateStyle: 'short' })}</p>
            <p><strong>رقم الفاتورة:</strong> #{activePrintOrder.id.substring(0, 8).toUpperCase()}</p>
          </div>

          {/* Items Table */}
          <table className="w-full text-[9px] mb-2 border-collapse">
            <thead>
              <tr className="border-b border-black text-right">
                <th className="pb-1 font-bold">الصنف</th>
                <th className="pb-1 text-center w-10 font-bold">الكمية</th>
                <th className="pb-1 text-left w-14 font-bold">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {activePrintOrder.order_items.map((item) => {
                const price = Number(item.price_at_purchase || 0);
                const qty = item.quantity;
                const total = price * qty;
                return (
                  <tr key={item.id} className="border-b border-dashed border-slate-200">
                    <td className="py-1">
                      <div className="font-bold">{item.product_name || item.products?.name || 'مادة'}</div>
                      <div className="text-[8px] text-slate-500 font-sans">{price.toFixed(2)} TL</div>
                    </td>
                    <td className="py-1 text-center font-bold font-mono">{qty}</td>
                    <td className="py-1 text-left font-bold font-mono">{total.toFixed(2)} TL</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Summary */}
          <div className="border-t border-black pt-1.5 space-y-1 text-[10px] font-bold">
            <div className="flex justify-between">
              <span>إجمالي الصناديق:</span>
              <span>{activePrintOrder.order_items.reduce((sum, item) => sum + item.quantity, 0)} صندوق</span>
            </div>
            <div className="flex justify-between text-[11px] border-t border-dashed border-black pt-1">
              <span>المجموع الكلي:</span>
              <span>{Number(activePrintOrder.total_price).toFixed(2)} TL</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-4 pt-2 border-t border-dashed border-black text-[8px] text-slate-500">
            <p>شكراً لتعاملكم معنا</p>
            <p className="mt-0.5">İDELBİ GIDA • 58mm Thermal</p>
          </div>
        </div>
      )}
    </>
  );
}
