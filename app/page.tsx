'use client'; // idelbi gida catalog portal

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { Search, ShoppingBag, Plus, Minus, Store, MessageCircle, AlertCircle, ShoppingCart } from 'lucide-react';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string;
  image_url: string | null;
  is_hidden?: boolean;
}

// Fallback mock data if Supabase is not connected
const MOCK_CATEGORIES: Category[] = [
  { id: '1', name: 'بسكويت وحلويات' },
  { id: '2', name: 'مشروبات وغازيات' },
  { id: '3', name: 'معلبات وأغذية مجففة' },
  { id: '4', name: 'البان وأجبان' }
];

const MOCK_PRODUCTS: Product[] = [
  { id: 'p1', name: 'بسكويت شوكولاتة أولكر 12 قطعة', price: 45.00, category_id: '1', image_url: null },
  { id: 'p2', name: 'شوكولاتة داماك بالفستق', price: 65.00, category_id: '1', image_url: null },
  { id: 'p3', name: 'شاي تركي غوكسو 100 ظرف', price: 85.00, category_id: '2', image_url: null },
  { id: 'p4', name: 'كوكا كولا علب 330 مل', price: 25.00, category_id: '2', image_url: null },
  { id: 'p5', name: 'صلصة طماطم تات 800 غ', price: 55.00, category_id: '3', image_url: null },
  { id: 'p6', name: 'أرز تركي بالدو 1 كغ', price: 70.00, category_id: '3', image_url: null },
  { id: 'p7', name: 'جبنة بيضاء بينار 500 غ', price: 110.00, category_id: '4', image_url: null },
  { id: 'p8', name: 'لبن زبادي سوتاس 1.5 كغ', price: 75.00, category_id: '4', image_url: null }
];

export default function CatalogPage() {
  const { cart, addToCart, removeFromCart, totalQuantity, totalPrice } = useCart();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Check if environment variables are set and look like placeholders
        const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
        const isKeyConfigured = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder');

        if (!isUrlConfigured || !isKeyConfigured) {
          throw new Error('Supabase environment variables not configured');
        }

        // Fetch categories
        const { data: catData, error: catError } = await supabase
          .from('categories')
          .select('*')
          .order('name', { ascending: true });

        if (catError) throw catError;

        // Fetch products
        const { data: prodData, error: prodError } = await supabase
          .from('products')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });

        if (prodError) throw prodError;

        setCategories(catData || []);
        setProducts(prodData || []);
        setUsingMockData(false);
      } catch (err) {
        console.warn('Database connection failed. Loading highly optimized offline demonstration catalog.', err);
        setCategories(MOCK_CATEGORIES);
        setProducts(MOCK_PRODUCTS);
        setUsingMockData(true);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Filter products by selected category and search query
  const filteredProducts = products.filter((product) => {
    // Hide product if is_hidden is set to true
    if (product.is_hidden === true) return false;
    
    const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getProductQuantity = (productId: string) => {
    const cartItem = cart.find((item) => item.id === productId);
    return cartItem ? cartItem.quantity : 0;
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 font-sans">
      {/* Top Banner for Demo Mode */}
      {usingMockData && (
        <div className="bg-amber-500 text-white px-4 py-1 text-center text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm shrink-0">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>وضع العرض التجريبي (غير متصل بقاعدة البيانات). لتفعيل قاعدة بياناتك الحية، يرجى إعداد ملف .env.local</span>
        </div>
      )}

      {/* Main Header - Clean B2B Brand */}
      <header className="sticky top-0 bg-[#075E54] text-white px-4 py-3.5 shadow-md z-40 shrink-0">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#128C7E] p-2.5 rounded-full text-white shadow-inner flex items-center justify-center">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">idelbi gida</h1>
              <p className="text-xs text-teal-100 font-medium">تجارة المواد الغذائية بالجملة • idelbi gıda</p>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Filters & Search */}
      <section className="bg-white border-b border-slate-200 py-3 px-4 sticky top-[68px] z-30 shadow-sm">
        <div className="max-w-md mx-auto space-y-3">
          {/* Search Input */}
          <div className="relative">
            <span className="absolute inset-y-0 right-3 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="ابحث عن منتج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-none outline-none rounded-xl pr-9 pl-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:bg-slate-50 focus:ring-2 focus:ring-[#128C7E]/40 transition-all text-right"
            />
          </div>

          {/* Categories Horizontal Slider */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 snap-x">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0 snap-start ${
                selectedCategory === 'all'
                  ? 'bg-[#128C7E] text-white border-[#128C7E] shadow-sm'
                  : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
              }`}
            >
              الكل
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0 snap-start ${
                  selectedCategory === category.id
                    ? 'bg-[#128C7E] text-white border-[#128C7E] shadow-sm'
                    : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Products Catalog Area */}
      <main className="flex-1 px-4 py-5 overflow-y-auto">
        <div className="max-w-md mx-auto">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white p-3.5 rounded-2xl border border-slate-100 flex gap-4 animate-pulse">
                  <div className="w-20 h-20 bg-slate-200 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                    <div className="h-4 bg-slate-200 rounded w-1/4" />
                    <div className="h-8 bg-slate-200 rounded w-1/3 mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="space-y-3.5">
              {filteredProducts.map((product) => {
                const qty = getProductQuantity(product.id);
                return (
                  <div
                    key={product.id}
                    className="bg-white p-3 rounded-2xl border border-slate-100 flex gap-3.5 items-center hover:shadow-sm transition-all"
                  >
                    {/* Product Image */}
                    <div className="w-20 h-20 relative bg-slate-100 rounded-xl shrink-0 overflow-hidden flex items-center justify-center border border-slate-200/50">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-teal-600/80 font-bold text-lg select-none">
                          {product.name.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Product Info & Actions */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-slate-800 truncate text-right">
                          {product.name}
                        </h3>
                        <p className="text-sm font-black text-[#128C7E] text-right">
                          {product.price.toFixed(2)} TL
                        </p>
                      </div>

                      {/* Quantity Selector - Minimalist & Prominent */}
                      <div className="flex justify-end mt-2">
                        {qty === 0 ? (
                          <button
                            onClick={() => addToCart(product)}
                            className="bg-[#25D366] text-white px-5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-[#20ba59] active:scale-95 transition-all shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>أضف</span>
                          </button>
                        ) : (
                          <div className="flex items-center bg-teal-50 border border-teal-200/50 rounded-full p-0.5 shadow-sm">
                            <button
                              onClick={() => removeFromCart(product.id)}
                              className="bg-white text-teal-700 hover:bg-teal-100 p-1.5 rounded-full transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-extrabold text-teal-900">
                              {qty}
                            </span>
                            <button
                              onClick={() => addToCart(product)}
                              className="bg-white text-teal-700 hover:bg-teal-100 p-1.5 rounded-full transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-100 space-y-3">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-600">لم نجد أي منتجات تطابق بحثك</h3>
              <p className="text-xs text-slate-400">تأكد من كتابة الاسم بشكل صحيح أو تصفح الأقسام الأخرى.</p>
            </div>
          )}
        </div>
      </main>

      {/* Floating Bottom Cart Bar - Active only when items added */}
      {totalQuantity > 0 && (
        <div className="sticky bottom-0 bg-transparent py-4 px-4 pointer-events-none z-50 shrink-0">
          <div className="max-w-md mx-auto pointer-events-auto">
            <Link
              href="/checkout"
              className="bg-[#25D366] hover:bg-[#20ba59] text-white rounded-2xl p-4 flex items-center justify-between shadow-xl active:scale-[0.99] transition-all duration-150 animate-bounce"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl text-white">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-teal-50 font-medium">سلتك الحالية</p>
                  <p className="text-sm font-bold">{totalQuantity} مواد</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-extrabold bg-[#128C7E] px-3.5 py-1.5 rounded-xl border border-teal-400/20">
                  {totalPrice.toFixed(2)} TL
                </span>
                <span className="text-xs font-bold leading-none">عرض الفاتورة &larr;</span>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
