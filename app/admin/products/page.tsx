'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, ShoppingBag, Loader2, Image as ImageIcon, Upload, AlertCircle, RefreshCw, GripVertical } from 'lucide-react';

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
  sort_order?: number;
  categories?: {
    name: string;
  } | null;
}

const MOCK_CATEGORIES: Category[] = [
  { id: '1', name: 'بسكويت وحلويات' },
  { id: '2', name: 'مشروبات وغازيات' },
  { id: '3', name: 'معلبات وأغذية مجففة' },
  { id: '4', name: 'البان وأجبان' }
];

const MOCK_PRODUCTS: Product[] = [
  { id: 'p1', name: 'بسكويت شوكولاتة أولكر 12 قطعة', price: 45.00, category_id: '1', image_url: null, categories: { name: 'بسكويت وحلويات' } },
  { id: 'p2', name: 'شوكولاتة داماك بالفستق', price: 65.00, category_id: '1', image_url: null, categories: { name: 'بسكويت وحلويات' } },
  { id: 'p3', name: 'شاي تركي غوكسو 100 ظرف', price: 85.00, category_id: '2', image_url: null, categories: { name: 'مشروبات وغازيات' } }
];

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Form fields
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Status
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Drag and drop states
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      if (!isUrlConfigured) {
        throw new Error('Supabase environment variables not configured');
      }

      // Fetch Categories
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (catError) throw catError;
      setCategories(catData || []);

      // Fetch Products with joined Category Name sorted by sort_order
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (prodError) throw prodError;

      const typedProducts: Product[] = (prodData || []).map((prod: any) => ({
        ...prod,
        categories: prod.categories ? { name: prod.categories.name } : null
      }));

      setProducts(typedProducts);
      setUsingMockData(false);
    } catch (err) {
      console.warn('Could not fetch data from database. Loading preview mode.', err);
      setCategories(MOCK_CATEGORIES);
      setProducts(MOCK_PRODUCTS);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  // Drag & Drop Handlers for product sorting
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== draggingId) {
      setDragOverId(id);
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) return;

    // Filtered list we are currently looking at
    const displayList = [...filteredDisplayProducts];

    const draggingIndex = displayList.findIndex(p => p.id === draggingId);
    const targetIndex = displayList.findIndex(p => p.id === targetId);

    if (draggingIndex === -1 || targetIndex === -1) return;

    // Reorder inside the active display list
    const [removed] = displayList.splice(draggingIndex, 1);
    displayList.splice(targetIndex, 0, removed);

    // Assign new sequential sort_orders for items inside this category
    const updatedDisplayList = displayList.map((prod, idx) => ({
      ...prod,
      sort_order: idx
    }));

    // Merge updates back into the main products list preserving other categories' positions
    let displayListIdx = 0;
    const updatedProducts = products.map((prod) => {
      if (selectedFilterCategory === 'all' || prod.category_id === selectedFilterCategory) {
        return updatedDisplayList[displayListIdx++];
      }
      return prod;
    });

    setProducts(updatedProducts);
    setDraggingId(null);
    setDragOverId(null);

    setSavingOrder(true);
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      
      if (isUrlConfigured) {
        // Upsert only the updated category items in database
        const updates = updatedDisplayList.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          category_id: p.category_id,
          image_url: p.image_url,
          sort_order: p.sort_order
        }));

        const { error } = await supabase
          .from('products')
          .upsert(updates);

        if (error) throw error;
      } else {
        console.log('Database not connected. Saved custom sort order locally.');
      }
    } catch (err) {
      console.error('Failed to save drag-and-drop sort order:', err);
      alert('حدث خطأ أثناء حفظ الترتيب الجديد في قاعدة البيانات.');
    } finally {
      setSavingOrder(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price || !categoryId) return;

    setErrorMsg('');
    setSubmitting(true);

    try {
      let finalImageUrl: string | null = null;
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

      if (isUrlConfigured) {
        // 1. Upload image to Storage if exists
        if (imageFile) {
          const fileExt = imageFile.name.split('.').pop();
          const fileName = `product-${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, imageFile, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.error('Image upload failed, proceeding without image:', uploadError);
          } else {
            // Get public URL
            const { data } = supabase.storage
              .from('product-images')
              .getPublicUrl(filePath);
            
            finalImageUrl = data.publicUrl;
          }
        }

        // 2. Insert product row in DB
        const { data: newProd, error: insertError } = await supabase
          .from('products')
          .insert({
            name: name.trim(),
            price: parseFloat(price),
            category_id: categoryId,
            image_url: finalImageUrl
          })
          .select('*, categories(name)')
          .single();

        if (insertError) throw insertError;

        const typedProd: Product = {
          ...newProd,
          categories: newProd.categories ? { name: newProd.categories.name } : null
        };

        setProducts((prev) => [typedProd, ...prev]);
      } else {
        // Mock add
        const matchingCat = categories.find(c => c.id === categoryId);
        const mockNewProd: Product = {
          id: Math.random().toString(),
          name: name.trim(),
          price: parseFloat(price),
          category_id: categoryId,
          image_url: imagePreview, // Use preview base64 as temporary image
          categories: matchingCat ? { name: matchingCat.name } : null
        };
        setProducts((prev) => [mockNewProd, ...prev]);
      }

      // Reset form
      setName('');
      setPrice('');
      setCategoryId('');
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ غير متوقع أثناء إضافة المنتج.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string, imageUrl: string | null) => {
    const confirmDelete = window.confirm(`هل أنت متأكد من حذف المنتج "${name}"؟`);
    if (!confirmDelete) return;

    setErrorMsg('');
    setDeletingId(id);

    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

      if (isUrlConfigured) {
        // Optionally delete image from storage
        if (imageUrl) {
          try {
            const fileName = imageUrl.split('/').pop();
            if (fileName) {
              await supabase.storage.from('product-images').remove([fileName]);
            }
          } catch (storageErr) {
            console.warn('Could not delete product image from storage bucket:', storageErr);
          }
        }

        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id);

        if (error) throw error;
      }

      // Remove from state
      setProducts((prev) => prev.filter((prod) => prod.id !== id));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء حذف المنتج.');
    } finally {
      setDeletingId(null);
    }
  };

  // Filter products for display
  const filteredDisplayProducts = products.filter(p => 
    selectedFilterCategory === 'all' || p.category_id === selectedFilterCategory
  );

  return (
    <div className="space-y-6">
      {/* Warning */}
      {usingMockData && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
          <span>وضع العرض التجريبي نشط. لإمكانية تخزين الصور حياً يرجى إعداد Supabase Storage ودلو `product-images`.</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">إدارة المنتجات</h1>
          <p className="text-xs text-slate-400 mt-1">تعديل وإضافة السلع الغذائية وتحديد أسعارها بالليرة التركية وتحميل صورها مباشرة</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
          title="تحديث البيانات"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Create Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-800">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">إضافة منتج جديد</h2>
          </div>

          <form onSubmit={handleAddProduct} className="space-y-4">
            {/* Product Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400">اسم المنتج</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم السلعة (مثال: قهوة تركي 250 غ)"
                className="w-full bg-slate-950 border border-slate-800 outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-right"
                disabled={submitting}
              />
            </div>

            {/* Product Price */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400">السعر (بالليرة التركية TL)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-950 border border-slate-800 outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-right"
                disabled={submitting}
              />
            </div>

            {/* Category selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400">قسم تصنيف المنتج</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 outline-none rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-right cursor-pointer"
                disabled={submitting}
              >
                <option value="" disabled className="text-slate-650">اختر القسم المناسب...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id} className="text-white bg-slate-950">
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Image Upload */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400">صورة المنتج</label>
              <div 
                onClick={() => !submitting && fileInputRef.current?.click()}
                className="w-full bg-slate-950 border border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all min-h-32 relative overflow-hidden"
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  ref={fileInputRef}
                  className="hidden"
                  disabled={submitting}
                />
                
                {imagePreview ? (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-950">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity gap-1.5 text-xs font-bold">
                      <Upload className="w-4 h-4" />
                      <span>تغيير الصورة</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8 text-slate-500" />
                    <span className="text-xs font-bold text-slate-400">انقر لتحميل صورة المنتج</span>
                    <span className="text-[10px] text-slate-500">صيغ JPG, PNG (حد أقصى 2 ميجا)</span>
                  </>
                )}
              </div>
            </div>

            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-xl text-xs font-semibold leading-relaxed">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !name.trim() || !price || !categoryId}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-850 disabled:text-slate-500 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4.5 h-4.5" />
              )}
              <span>إضافة المنتج للمتجر</span>
            </button>
          </form>
        </div>

        {/* Products Table/List */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3.5 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">المنتجات المتوفرة حالياً ({filteredDisplayProducts.length})</h2>
            </div>
            
            {/* Category Filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">عرض القسم:</span>
              <select
                value={selectedFilterCategory}
                onChange={(e) => setSelectedFilterCategory(e.target.value)}
                className="bg-slate-950 border border-slate-850 outline-none rounded-xl px-3 py-1.5 text-xs text-white cursor-pointer focus:border-emerald-500 transition-colors"
              >
                <option value="all">كل الأقسام</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-xs font-bold">جاري تحميل المنتجات من المستودع...</p>
            </div>
          ) : filteredDisplayProducts.length > 0 ? (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-bold text-slate-400">
                    <th className="pb-3 text-right">المنتج</th>
                    <th className="pb-3 text-right">القسم</th>
                    <th className="pb-3 text-right">السعر</th>
                    <th className="pb-3 text-center w-16">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDisplayProducts.map((product, index) => (
                    <tr 
                      key={product.id}
                      draggable={!submitting && !savingOrder}
                      onDragStart={(e) => handleDragStart(e, product.id)}
                      onDragOver={(e) => handleDragOver(e, product.id)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, product.id)}
                      className={`align-middle transition-all cursor-grab active:cursor-grabbing hover:bg-slate-850/20 ${
                        draggingId === product.id ? 'opacity-40 bg-slate-800/50' : ''
                      } ${
                        dragOverId === product.id ? 'border-b-2 border-emerald-500 bg-emerald-500/5' : 'border-b border-slate-800/40'
                      }`}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing shrink-0 p-1" title="اسحب لإعادة الترتيب">
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-xs text-emerald-400 font-bold">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              product.name.charAt(0)
                            )}
                          </div>
                          <span className="text-sm font-bold text-slate-200 line-clamp-1">{product.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-sm text-slate-400">
                        {product.categories?.name || 'بدون قسم'}
                      </td>
                      <td className="py-3 text-sm font-extrabold text-emerald-400 whitespace-nowrap">
                        {Number(product.price).toFixed(2)} TL
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => handleDeleteProduct(product.id, product.name, product.image_url)}
                          disabled={deletingId === product.id}
                          className="p-1.5 bg-slate-950 hover:bg-rose-500/10 border border-slate-850 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                        >
                          {deletingId === product.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 space-y-2">
              <ShoppingBag className="w-12 h-12 text-slate-700 mx-auto" />
              <h3 className="text-sm font-bold text-slate-400">
                {selectedFilterCategory === 'all' ? 'لا يوجد منتجات معروضة بعد' : 'لا يوجد منتجات في هذا القسم حالياً'}
              </h3>
              <p className="text-xs text-slate-500">
                {selectedFilterCategory === 'all' 
                  ? 'أضف منتجاتك الأولى عبر النموذج الجانبي لكي يتمكن الزبائن من شرائها.' 
                  : 'اختر قسماً آخر أو أضف منتجات جديدة وخصصها لهذا القسم.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
