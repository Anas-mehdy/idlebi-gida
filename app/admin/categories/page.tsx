'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Folder, Loader2, AlertCircle } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  created_at?: string;
}

const MOCK_CATEGORIES: Category[] = [
  { id: '1', name: 'بسكويت وحلويات' },
  { id: '2', name: 'مشروبات وغازيات' },
  { id: '3', name: 'معلبات وأغذية مجففة' },
  { id: '4', name: 'البان وأجبان' }
];

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
          .insert({ name: newCategoryName.trim() })
          .select()
          .single();

        if (error) throw error;
        
        // Add to active state
        setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        // Mock add
        const newCat: Category = {
          id: Math.random().toString(),
          name: newCategoryName.trim()
        };
        setCategories((prev) => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
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
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', id);

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
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
          <span>وضع العرض التجريبي نشط. التعديلات ستنعكس مؤقتاً في واجهة المتصفح فقط.</span>
        </div>
      )}

      {/* Header Info */}
      <div>
        <h1 className="text-xl font-bold text-white">إدارة أقسام الكتالوج</h1>
        <p className="text-xs text-slate-400 mt-1">أضف أو احذف الأقسام لتصنيف المواد الغذائية في المتجر (مثل: بسكويت، معلبات، مشروبات)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Create Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-800">
            <Folder className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">إضافة قسم جديد</h2>
          </div>

          <form onSubmit={handleAddCategory} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-400">اسم القسم</label>
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="أدخل اسم القسم (مثال: أجبان وألبان)"
                className="w-full bg-slate-950 border border-slate-800 outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-right"
                disabled={submitting}
              />
            </div>

            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-xl text-xs font-semibold leading-relaxed">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !newCategoryName.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-850 disabled:text-slate-500 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
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
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:col-span-2 space-y-4">
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-800">
            <Folder className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">الأقسام الحالية ({categories.length})</h2>
          </div>

          {loading ? (
            <div className="py-10 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <p className="text-xs font-bold">جاري تحميل الأقسام...</p>
            </div>
          ) : categories.length > 0 ? (
            <div className="divide-y divide-slate-800">
              {categories.map((category) => (
                <div key={category.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-950 p-2 rounded-xl text-slate-400 border border-slate-850">
                      <Folder className="w-4.5 h-4.5 text-emerald-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-200">{category.name}</span>
                  </div>

                  <button
                    onClick={() => handleDeleteCategory(category.id, category.name)}
                    disabled={deletingId === category.id}
                    className="p-2 bg-slate-950 hover:bg-rose-500/10 border border-slate-850 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-all cursor-pointer"
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
              <Folder className="w-10 h-10 text-slate-700 mx-auto" />
              <h3 className="text-sm font-bold text-slate-400">لا يوجد أقسام مضافة بعد</h3>
              <p className="text-xs text-slate-500">قم بإضافة قسمك الأول باستخدام النموذج الجانبي لتصنيف المنتجات.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
