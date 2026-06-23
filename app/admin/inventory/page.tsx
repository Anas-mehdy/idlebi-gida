'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Trash2, ShoppingBag, Loader2, AlertCircle, RefreshCw, X, 
  Search, Boxes, Save, Minus, Check, ArrowLeft, ArrowRight, ArrowRightLeft, Layers, Edit, Eye 
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  sort_order?: number;
}

interface Product {
  id: string;
  name: string;
  price: number | null;
  category_id: string;
  image_url: string | null;
  is_hidden: boolean;
  inventory_stock: number | null; // NULL means not tracked
  categories?: {
    name: string;
  } | null;
}

const MOCK_CATEGORIES: Category[] = [
  { id: '1', name: 'بسكويت وحلويات', sort_order: 0 },
  { id: '2', name: 'مشروبات وغازيات', sort_order: 1 },
  { id: '3', name: 'معلبات وأغذية مجففة', sort_order: 2 },
  { id: '4', name: 'البان وأجبان', sort_order: 3 }
];

const MOCK_PRODUCTS: Product[] = [
  { id: 'p1', name: 'بسكويت شوكولاتة أولكر 12 قطعة', price: 45.00, category_id: '1', image_url: null, is_hidden: false, inventory_stock: 50, categories: { name: 'بسكويت وحلويات' } },
  { id: 'p2', name: 'شوكولاتة داماك بالفستق', price: 65.00, category_id: '1', image_url: null, is_hidden: false, inventory_stock: null, categories: { name: 'بسكويت وحلويات' } },
  { id: 'p3', name: 'شاي تركي غوكسو 100 ظرف', price: 85.00, category_id: '2', image_url: null, is_hidden: false, inventory_stock: 120, categories: { name: 'مشروبات وغازيات' } }
];

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [usingMockData, setUsingMockData] = useState(false);

  // Search tracked inventory state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('all');

  // Search database to add new products state
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [dbSearchResults, setDbSearchResults] = useState<Product[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Add to inventory modal/inline state
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<Product | null>(null);
  const [initialStockInput, setInitialStockInput] = useState<string>('10');

  // Inline editing state
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockValue, setEditingStockValue] = useState<string>('');

  // Action loaders
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      
      if (!isUrlConfigured) {
        throw new Error('Supabase environment variables not configured');
      }

      // Fetch Categories
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (catError) throw catError;
      setCategories(catData || []);

      // Fetch Products with category joined
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('name', { ascending: true });

      if (prodError) throw prodError;

      const typedProducts: Product[] = (prodData || []).map((prod: any) => ({
        ...prod,
        categories: prod.categories ? { name: prod.categories.name } : null
      }));

      setProducts(typedProducts);
      setUsingMockData(false);
    } catch (err) {
      console.warn('Could not fetch data from database. Loading preview/mock mode.', err);
      
      // Load mock categories
      setCategories(MOCK_CATEGORIES);
      
      // Look for products in localStorage for mock persistence, otherwise use defaults
      const savedProducts = localStorage.getItem('demo_inventory_products');
      if (savedProducts) {
        try {
          setProducts(JSON.parse(savedProducts));
        } catch {
          setProducts(MOCK_PRODUCTS);
        }
      } else {
        setProducts(MOCK_PRODUCTS);
      }
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Save mock products to local storage for persistence in demo mode
  const saveMockProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    if (usingMockData) {
      localStorage.setItem('demo_inventory_products', JSON.stringify(newProducts));
    }
  };

  // Perform search in the database/all products
  useEffect(() => {
    if (!dbSearchQuery.trim()) {
      setDbSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const query = dbSearchQuery.toLowerCase();
    const results = products.filter(p => 
      p.name.toLowerCase().includes(query) || 
      (p.categories?.name && p.categories.name.toLowerCase().includes(query))
    );
    
    setDbSearchResults(results);
    setShowSearchResults(true);
  }, [dbSearchQuery, products]);

  // Handle adding a product to inventory tracking
  const handleAddToInventory = async () => {
    if (!selectedProductToAdd) return;
    
    const stockVal = parseInt(initialStockInput, 10);
    if (isNaN(stockVal)) {
      alert('يرجى إدخال رقم صحيح للمخزون.');
      return;
    }

    const prodId = selectedProductToAdd.id;
    setActionLoadingId(prodId);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isUrlConfigured && !usingMockData) {
        const { error } = await supabase
          .from('products')
          .update({ inventory_stock: stockVal })
          .eq('id', prodId);

        if (error) throw error;
      }

      // Update local state
      const updatedProducts = products.map(p => {
        if (p.id === prodId) {
          return { ...p, inventory_stock: stockVal };
        }
        return p;
      });

      saveMockProducts(updatedProducts);
      setSuccessMsg(`تمت إضافة المنتح "${selectedProductToAdd.name}" إلى تتبع المخزون بنجاح.`);
      
      // Reset search and modal
      setSelectedProductToAdd(null);
      setDbSearchQuery('');
      setShowSearchResults(false);

      // Auto clear success message
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء إضافة المنتج للمخزون.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Quick increase/decrease quantity by offset (e.g. +1, -1)
  const handleQuickAdjust = async (productId: string, offset: number) => {
    setActionLoadingId(productId);
    setErrorMsg('');

    const targetProduct = products.find(p => p.id === productId);
    if (!targetProduct || targetProduct.inventory_stock === null) {
      setActionLoadingId(null);
      return;
    }

    const currentStock = targetProduct.inventory_stock;
    const newStock = currentStock + offset; // Allows negative values

    try {
      if (isUrlConfigured && !usingMockData) {
        const { error } = await supabase
          .from('products')
          .update({ inventory_stock: newStock })
          .eq('id', productId);

        if (error) throw error;
      }

      const updatedProducts = products.map(p => {
        if (p.id === productId) {
          return { ...p, inventory_stock: newStock };
        }
        return p;
      });

      saveMockProducts(updatedProducts);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء تعديل كمية المخزون.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Direct manual stock update from inline input
  const handleDirectUpdateStock = async (productId: string) => {
    const value = parseInt(editingStockValue, 10);
    if (isNaN(value)) {
      alert('يرجى إدخال قيمة عددية صحيحة.');
      return;
    }

    setActionLoadingId(productId);
    setErrorMsg('');

    try {
      if (isUrlConfigured && !usingMockData) {
        const { error } = await supabase
          .from('products')
          .update({ inventory_stock: value })
          .eq('id', productId);

        if (error) throw error;
      }

      const updatedProducts = products.map(p => {
        if (p.id === productId) {
          return { ...p, inventory_stock: value };
        }
        return p;
      });

      saveMockProducts(updatedProducts);
      setEditingStockId(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء تحديث كمية المخزون.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Untrack inventory (set inventory_stock to NULL)
  const handleRemoveFromInventory = async (productId: string, productName: string) => {
    const confirmRemove = window.confirm(`هل أنت متأكد من رغبتك في إيقاف تتبع مخزون "${productName}"؟ سيتم مسح بيانات الكمية المتوفرة له ولن يتأثر بعمليات البيع.`);
    if (!confirmRemove) return;

    setActionLoadingId(productId);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isUrlConfigured && !usingMockData) {
        const { error } = await supabase
          .from('products')
          .update({ inventory_stock: null })
          .eq('id', productId);

        if (error) throw error;
      }

      const updatedProducts = products.map(p => {
        if (p.id === productId) {
          return { ...p, inventory_stock: null };
        }
        return p;
      });

      saveMockProducts(updatedProducts);
      setSuccessMsg(`تم إيقاف تتبع مخزون "${productName}" بنجاح.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء إزالة المنتج من المخزون.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter tracked products
  const trackedProducts = products.filter(p => p.inventory_stock !== null);
  
  const filteredTrackedProducts = trackedProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedFilterCategory === 'all' || p.category_id === selectedFilterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 font-sans text-right pb-10" dir="rtl">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-2xl text-emerald-600 border border-emerald-500/20">
              <Boxes className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black text-slate-850">إدارة مخزون المستودع</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            تتبع وإدارة مخزون البضائع المتاحة بالصناديق. ينخفض المخزون تلقائياً عند طلب الزبون وينعكس التعديل عند تعديل الفواتير.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="self-start md:self-center bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95 border border-slate-200/80 shadow-2xs"
        >
          <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث البيانات</span>
        </button>
      </div>

      {/* Demo Warning */}
      {usingMockData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">وضع العرض التجريبي نشط:</span> لم يتم العثور على تهيئة لقاعدة بيانات Supabase. التغييرات التي تجريها الآن تُحفظ في ذاكرة المتصفح المؤقتة (Local Storage).
          </div>
        </div>
      )}

      {/* Main Grid: Add Inventory & Search Tracked */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Add Product to Inventory */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-800">إضافة منتج متتبع للمخزون</h2>
            </div>
            
            <p className="text-[11px] text-slate-500 leading-relaxed">
              ابحث عن أي منتج من قائمة المنتجات المتاحة لإدراجه تحت إدارة المخزون وتحديد عدد الصناديق المتوفرة لديه.
            </p>

            {/* Search Input for DB Products */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ابحث بالاسم لإضافة السلعة..."
                value={dbSearchQuery}
                onChange={(e) => setDbSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 outline-none rounded-xl pr-10 pl-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all text-right"
              />
              {dbSearchQuery && (
                <button
                  onClick={() => setDbSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown List */}
            {showSearchResults && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-150 shadow-2xs">
                {dbSearchResults.length > 0 ? (
                  dbSearchResults.map((prod) => {
                    const isTracked = prod.inventory_stock !== null;
                    return (
                      <div 
                        key={prod.id} 
                        className="p-3 flex items-center justify-between text-xs hover:bg-slate-100/80 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {prod.image_url ? (
                            <img src={prod.image_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <ShoppingBag className="w-8 h-8 p-1.5 bg-white text-slate-400 border border-slate-200 rounded-lg shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-850 truncate">{prod.name}</p>
                            <p className="text-[10px] text-slate-400">{prod.categories?.name || 'بدون قسم'}</p>
                          </div>
                        </div>

                        {isTracked ? (
                          <div className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-1 rounded-lg shrink-0">
                            مضاف: {prod.inventory_stock} صندوق
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedProductToAdd(prod);
                              setInitialStockInput('10');
                            }}
                            className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white border border-emerald-500/20 font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition-all cursor-pointer shadow-2xs shrink-0"
                          >
                            إختر المنتج
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    لم نعثر على أي منتج يطابق بحثك.
                  </div>
                )}
              </div>
            )}

            {/* Selected Product Form/Modal (Inline) */}
            {selectedProductToAdd && (
              <div className="bg-emerald-500/5 border border-emerald-100 rounded-2xl p-4 space-y-4 animate-fadeIn">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    {selectedProductToAdd.image_url ? (
                      <img src={selectedProductToAdd.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-emerald-200 shrink-0" />
                    ) : (
                      <ShoppingBag className="w-10 h-10 p-2 bg-white text-emerald-500/60 border border-emerald-200 rounded-lg shrink-0" />
                    )}
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-800">{selectedProductToAdd.name}</h3>
                      <p className="text-[10px] text-slate-500">{selectedProductToAdd.categories?.name || 'بدون قسم'}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setSelectedProductToAdd(null)}
                    className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-200 p-1 rounded-full border border-slate-200 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Stock input field */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-650">الكمية المتوفرة حالياً (عدد الصناديق):</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={initialStockInput}
                      onChange={(e) => setInitialStockInput(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 outline-none rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all text-right"
                    />
                    
                    <button
                      onClick={handleAddToInventory}
                      disabled={actionLoadingId === selectedProductToAdd.id}
                      className="bg-[#128C7E] hover:bg-[#128C7E]/95 disabled:bg-slate-100 text-white font-bold px-4 py-2.5 rounded-xl text-xs shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      {actionLoadingId === selectedProductToAdd.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>تأكيد الإضافة</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Tracked Inventory Products List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
            
            {/* Header & Internal Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>المنتجات المتتبعة في المخزون</span>
                  <span className="bg-[#128C7E]/10 text-[#128C7E] font-extrabold px-2 py-0.5 rounded-full text-[10px]">
                    {filteredTrackedProducts.length} من {trackedProducts.length}
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">قائمة بالمنتجات التي تخضع حالياً لمراقبة وتحديث كميات المخزون.</p>
              </div>

              {/* Internal search and category filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                {/* Search in tracked */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="بحث في المخزون..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-50 border border-slate-200 outline-none rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#128C7E] transition-all text-right w-full sm:w-44"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-700">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Category Dropdown Filter */}
                <select
                  value={selectedFilterCategory}
                  onChange={(e) => setSelectedFilterCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-200 outline-none rounded-xl px-2.5 py-1.5 text-xs text-slate-700 cursor-pointer focus:border-[#128C7E] transition-colors"
                >
                  <option value="all">كل الأقسام</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error or Success Toast Notifications */}
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 p-3 rounded-xl text-xs flex items-center gap-2.5 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 p-3 rounded-xl text-xs flex items-center gap-2.5 font-bold">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Loading Indicator */}
            {loading ? (
              <div className="py-16 text-center text-slate-450 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-[#128C7E] animate-spin" />
                <p className="text-xs font-semibold">جاري تحميل المخزون...</p>
              </div>
            ) : filteredTrackedProducts.length > 0 ? (
              
              /* Desktop and Mobile Responsive Table/List */
              <div className="overflow-x-auto border border-slate-150 rounded-2xl">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] text-slate-500 font-bold border-b border-slate-150">
                      <th className="p-3">المنتج</th>
                      <th className="p-3 text-center">القسم</th>
                      <th className="p-3 text-center min-w-44">الكمية (صناديق)</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-xs">
                    {filteredTrackedProducts.map((prod) => {
                      const isEditing = editingStockId === prod.id;
                      const isActionLoading = actionLoadingId === prod.id;
                      
                      return (
                        <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors">
                          
                          {/* Product Info */}
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              {prod.image_url ? (
                                <img src={prod.image_url} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" />
                              ) : (
                                <ShoppingBag className="w-10 h-10 p-2 bg-slate-50 text-slate-400 border border-slate-200 rounded-xl shrink-0" />
                              )}
                              <span className="font-bold text-slate-800 leading-tight block truncate max-w-44 sm:max-w-64" title={prod.name}>
                                {prod.name}
                              </span>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="p-3 text-center text-[11px] text-slate-500 font-bold">
                            {prod.categories?.name || 'بدون قسم'}
                          </td>

                          {/* Inventory Stock Count and Adjustments */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {isEditing ? (
                                /* Direct number edit mode */
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    value={editingStockValue}
                                    onChange={(e) => setEditingStockValue(e.target.value)}
                                    className="w-16 bg-white border border-slate-300 outline-none rounded-lg px-2 py-1 text-center font-bold text-xs"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleDirectUpdateStock(prod.id)}
                                    disabled={isActionLoading}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg transition-all shadow-xs cursor-pointer"
                                    title="حفظ الكمية"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingStockId(null)}
                                    className="bg-slate-200 hover:bg-slate-350 text-slate-650 p-1.5 rounded-lg transition-all cursor-pointer"
                                    title="إلغاء التعديل"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                /* Quick increment/decrement buttons mode */
                                <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-0.5 border border-slate-200/50">
                                  {/* Decrement Button */}
                                  <button
                                    onClick={() => handleQuickAdjust(prod.id, -1)}
                                    disabled={isActionLoading}
                                    className="bg-white hover:bg-rose-50 text-rose-600 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all active:scale-90 border border-slate-200/40 hover:border-rose-100 shadow-2xs font-extrabold"
                                    title="تنقيص 1 صندوق"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>

                                  {/* Current Stock Value display */}
                                  <div 
                                    onClick={() => {
                                      setEditingStockId(prod.id);
                                      setEditingStockValue(String(prod.inventory_stock));
                                    }}
                                    className={`px-3 text-center min-w-12 font-mono font-black text-sm select-none cursor-pointer hover:bg-white hover:shadow-2xs rounded-lg py-1 transition-all ${
                                      (prod.inventory_stock ?? 0) <= 0 
                                        ? 'text-rose-600 bg-rose-50 border border-rose-100/30' 
                                        : 'text-slate-800'
                                    }`}
                                    title="اضغط لتعديل الرقم يدوياً"
                                  >
                                    {prod.inventory_stock}
                                  </div>

                                  {/* Increment Button */}
                                  <button
                                    onClick={() => handleQuickAdjust(prod.id, 1)}
                                    disabled={isActionLoading}
                                    className="bg-white hover:bg-emerald-50 text-emerald-600 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all active:scale-90 border border-slate-200/40 hover:border-emerald-100 shadow-2xs font-extrabold"
                                    title="زيادة 1 صندوق"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Untrack action */}
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleRemoveFromInventory(prod.id, prod.name)}
                              disabled={isActionLoading}
                              className="text-rose-500 hover:text-white bg-rose-500/10 hover:bg-rose-650 p-2 rounded-xl border border-rose-500/10 transition-all cursor-pointer shadow-2xs"
                              title="إيقاف تتبع المخزون"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Empty list state */
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-4">
                <div className="bg-slate-200/50 p-4 rounded-full inline-block text-slate-400">
                  <Boxes className="w-10 h-10" />
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-700">لا يوجد منتجات متتبعة حالياً</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    قائمة المخزون فارغة. للبدء بمراقبة المخزون، ابحث عن المنتجات من خلال حقل البحث الجانبي باليمين وقم بإضافتها.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
