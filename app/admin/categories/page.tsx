'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Folder, Loader2, AlertCircle, GripVertical } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  created_at?: string;
  sort_order?: number;
}

const MOCK_CATEGORIES: Category[] = [
  { id: '1', name: 'بسكويت وحلويات', sort_order: 0 },
  { id: '2', name: 'مشروبات وغازيات', sort_order: 1 },
  { id: '3', name: 'معلبات وأغذية مجففة', sort_order: 2 },
  { id: '4', name: 'البان وأجبان', sort_order: 3 }
];

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Drag and drop states
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      if (!isUrlConfigured) {
        throw new Error('Supabase environment variables not configured');
      }

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
      setUsingMockData(false);
    } catch (err) {
      console.warn('Could not fetch categories from database. Loading preview mode.', err);
      setCategories(MOCK_CATEGORIES);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Drag & Drop Handlers for categories sorting
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

    const displayList = [...categories];

    const draggingIndex = displayList.findIndex(c => c.id === draggingId);
    const targetIndex = displayList.findIndex(c => c.id === targetId);

    if (draggingIndex === -1 || targetIndex === -1) return;

    // Reorder inside list
    const [removed] = displayList.splice(draggingIndex, 1);
    displayList.splice(targetIndex, 0, removed);

    // Assign new sequential sort_orders
    const updatedCategories = displayList.map((cat, idx) => ({
      ...cat,
      sort_order: idx
    }));

    setCategories(updatedCategories);
    setDraggingId(null);
    setDragOverId(null);

    setSavingOrder(true);
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      
      if (isUrlConfigured) {
        // Upsert updated categories in database
        const updates = updatedCategories.map(c => ({
          id: c.id,
          name: c.name,
          sort_order: c.sort_order
        }));

        const { error } = await supabase
          .from('categories')
          .upsert(updates);

        if (error) throw error;
      } else {
        console.log('Database not connected. Saved custom category sort order locally.');
      }
    } catch (err) {
      console.error('Failed to save category sort order:', err);
      alert('حدث خطأ أثناء حفظ الترتيب الجديد للأقسام في قاعدة البيانات.');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setErrorMsg('');
    setSubmitting(true);

    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

      if (isUrlConfigured) {
        const { data, error } = await supabase
          .from('categories')
          .insert({ 
            name: newCategoryName.trim(),
            sort_order: categories.length
          })
          .select()
          .single();

        if (error) throw error;
        
        // Add to active state (append to the end since its sort_order is categories.length)
        setCategories((prev) => [...prev, data]);
      } else {
        // Mock add
        const newCat: Category = {
          id: Math.random().toString(),
          name: newCategoryName.trim(),
          sort_order: categories.length
        };
        setCategories((prev) => [...prev, newCat]);
      }

      setNewCategoryName('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء إضافة القسم. تأكد من أن الاسم غير مكرر.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const confirmDelete = window.confirm(`هل أنت متأكد من حذف قسم "${name}"؟ سيؤدي ذلك لحذف جميع المنتجات التابعة له تلقائياً!`);
    if (!confirmDelete) return;

    setErrorMsg('');
    setDeletingId(id);

    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

      if (isUrlConfigured) {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw error;
      }

      // Remove from state
      setCategories((prev) => prev.filter((cat) => cat.id !== id));
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء حذف القسم.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning */}
      {usingMockData && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
          <span>وضع العرض التجريبي نشط. التعديلات ستنعكس مؤقتاً في واجهة المتصفح فقط.</span>
        </div>
      )}

      {/* Header Info */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">إدارة أقسام الكتالوج</h1>
        <p className="text-xs text-slate-500 mt-1">أضف أو احذف الأقسام لتصنيف المواد الغذائية في المتجر (مثل: بسكويت، معلبات، مشروبات)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Create Form */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
            <Folder className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">إضافة قسم جديد</h2>
          </div>

          <form onSubmit={handleAddCategory} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">اسم القسم</label>
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="أدخل اسم القسم (مثال: أجبان وألبان)"
                className="w-full bg-slate-50 border border-slate-200 outline-none rounded-xl px-4 py-3 text-sm text-slate-850 placeholder-slate-400 focus:bg-white focus:border-[#128C7E] focus:ring-1 focus:ring-[#128C7E] transition-all text-right"
                disabled={submitting}
              />
            </div>

            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-800 p-3 rounded-xl text-xs font-semibold leading-relaxed">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !newCategoryName.trim()}
              className="w-full bg-emerald-650 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-450 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
              style={{ backgroundColor: '#128C7E' }}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4.5 h-4.5" />
              )}
              <span>إضافة القسم</span>
            </button>
          </form>
        </div>

        {/* Categories List */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 md:col-span-2 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
            <Folder className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">الأقسام الحالية ({categories.length})</h2>
          </div>

          {loading ? (
            <div className="py-10 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-bold">جاري تحميل الأقسام...</p>
            </div>
          ) : categories.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {categories.map((category) => (
                <div 
                  key={category.id} 
                  draggable={!submitting && !savingOrder}
                  onDragStart={(e) => handleDragStart(e, category.id)}
                  onDragOver={(e) => handleDragOver(e, category.id)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, category.id)}
                  className={`py-3 flex items-center justify-between gap-4 transition-all cursor-grab active:cursor-grabbing hover:bg-slate-50/50 px-2 rounded-xl ${
                    draggingId === category.id ? 'opacity-40 bg-slate-105' : ''
                  } ${
                    dragOverId === category.id ? 'border-b-2 border-emerald-500 bg-emerald-500/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0 p-1" title="اسحب لإعادة الترتيب">
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <div className="bg-slate-50 p-2 rounded-xl text-slate-600 border border-slate-200">
                      <Folder className="w-4.5 h-4.5 text-emerald-600" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">{category.name}</span>
                  </div>

                  <button
                    onClick={() => handleDeleteCategory(category.id, category.name)}
                    disabled={deletingId === category.id}
                    className="p-2 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 rounded-xl transition-all cursor-pointer"
                  >
                    {deletingId === category.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4.5 h-4.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 space-y-2">
              <Folder className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">لا يوجد أقسام مضافة بعد</h3>
              <p className="text-xs text-slate-500">قم بإضافة قسمك الأول باستخدام النموذج الجانبي لتصنيف المنتجات.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
