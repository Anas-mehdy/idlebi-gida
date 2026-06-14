'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, Plus, Trash2, Edit2, CheckSquare, X, Search, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  created_at: string;
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [usingMock, setUsingMock] = useState(false);

  // Form states
  const [newName, setNewName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      
      if (!isUrlConfigured) {
        throw new Error('Supabase environment variables not configured');
      }

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
      setUsingMock(false);
    } catch (err) {
      console.warn('Could not fetch customers from database. Loading localStorage database.', err);
      const localData = JSON.parse(localStorage.getItem('idlebi_customers') || '[]');
      if (localData.length === 0) {
        // Seed initial customers if empty
        const seed = [
          { id: 'c1', name: 'سوبر ماركت الياسمين', created_at: new Date().toISOString() },
          { id: 'c2', name: 'بقالة النور', created_at: new Date().toISOString() },
          { id: 'c3', name: 'أسواق أورفا الغذائية', created_at: new Date().toISOString() },
          { id: 'c4', name: 'مطعم السلام الدمشقي', created_at: new Date().toISOString() }
        ];
        localStorage.setItem('idlebi_customers', JSON.stringify(seed));
        setCustomers(seed);
      } else {
        setCustomers(localData);
      }
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    if (!cleanName) return;

    // Duplicate check
    if (customers.some(c => c.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      alert('اسم الزبون هذا موجود بالفعل في القائمة.');
      return;
    }

    setIsUpdating(true);
    try {
      if (!usingMock) {
        const { data, error } = await supabase
          .from('customers')
          .insert({ name: cleanName })
          .select();

        if (error) throw error;
        if (data && data[0]) {
          setCustomers(prev => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name, 'ar')));
        }
      } else {
        const newCust: Customer = {
          id: 'local-' + Date.now(),
          name: cleanName,
          created_at: new Date().toISOString()
        };
        const updated = [...customers, newCust].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        localStorage.setItem('idlebi_customers', JSON.stringify(updated));
        setCustomers(updated);
      }
      setNewName('');
      alert('تم إضافة الزبون بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء إضافة الزبون.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRenameCustomer = async (id: string) => {
    const cleanName = tempName.trim();
    if (!cleanName) return;

    if (customers.some(c => c.id !== id && c.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      alert('اسم الزبون هذا موجود بالفعل لزبون آخر.');
      return;
    }

    setIsUpdating(true);
    try {
      if (!usingMock) {
        const { error } = await supabase
          .from('customers')
          .update({ name: cleanName })
          .eq('id', id);

        if (error) throw error;
      } else {
        const updated = customers.map(c => c.id === id ? { ...c, name: cleanName } : c);
        localStorage.setItem('idlebi_customers', JSON.stringify(updated));
      }

      setCustomers(prev => prev.map(c => c.id === id ? { ...c, name: cleanName } : c).sort((a, b) => a.name.localeCompare(b.name, 'ar')));
      setEditingId(null);
      alert('تم تعديل اسم الزبون بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء تعديل اسم الزبون.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    const confirmAction = window.confirm(`هل أنت متأكد من حذف الزبون "${name}" نهائياً؟`);
    if (!confirmAction) return;

    setIsUpdating(true);
    try {
      if (!usingMock) {
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } else {
        const updated = customers.filter(c => c.id !== id);
        localStorage.setItem('idlebi_customers', JSON.stringify(updated));
      }

      setCustomers(prev => prev.filter(c => c.id !== id));
      alert('تم حذف الزبون بنجاح!');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء حذف الزبون.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Filtered List
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Offline Preview Banner */}
      {usingMock && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
          <span>وضع العرض التجريبي لقائمة الزبائن نشط. يتم حفظ وتعديل الأسماء محلياً في المتصفح.</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">قائمة الزبائن</h1>
          <p className="text-xs text-slate-500 mt-1">إضافة وإدارة أسماء زبائن المتجر المعتمدين لتوحيد وتسهيل مطابقة فواتيرهم</p>
        </div>
        <button
          onClick={fetchCustomers}
          disabled={loading}
          className="p-2.5 bg-white border border-slate-200 hover:border-slate-350 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
          title="تحديث القائمة"
        >
          <RefreshCw className="w-4 h-4 animate-duration-1000" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Add Customer Form */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm h-fit space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">إضافة زبون جديد</h2>
          </div>
          
          <form onSubmit={handleAddCustomer} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">اسم الزبون / المحل التجاري</label>
              <input
                type="text"
                placeholder="مثال: بقالة الأمل، سوبر ماركت..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-250 outline-none rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-right font-bold"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={isUpdating || !newName.trim()}
              className="w-full bg-[#128C7E] hover:bg-[#128C7E]/95 disabled:bg-slate-250 disabled:text-slate-450 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{isUpdating ? 'جاري الحفظ...' : 'حفظ الزبون في القائمة'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Search & Manage Customers list */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-650" />
              <h2 className="text-sm font-bold text-slate-850">قائمة الزبائن الحالية</h2>
            </div>
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ابحث عن اسم زبون..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-250 outline-none rounded-xl pr-9 pl-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-right"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-455 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-655" />
              <p className="text-xs font-bold">جاري تحميل قائمة الزبائن...</p>
            </div>
          ) : filteredCustomers.length > 0 ? (
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto pr-1">
              {filteredCustomers.map((cust) => (
                <div key={cust.id} className="py-3 flex items-center justify-between gap-4">
                  {editingId === cust.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="flex-1 bg-white border border-slate-300 outline-none rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-650 font-bold"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameCustomer(cust.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <button
                        onClick={() => handleRenameCustomer(cust.id)}
                        disabled={isUpdating}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer border border-emerald-100"
                        title="حفظ التعديل"
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-2 text-slate-455 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
                        title="إلغاء"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-slate-805">{cust.name}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingId(cust.id);
                            setTempName(cust.name);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="تعديل الاسم"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(cust.id, cust.name)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف الزبون"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 space-y-2">
              <Users className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-xs font-bold text-slate-705">لا يوجد زبائن مطابقين</h3>
              <p className="text-[11px] text-slate-500">أضف زبائن جدد أو عدل كلمة البحث.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
