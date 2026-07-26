'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Users, Plus, Trash2, Edit2, CheckSquare, X, Search, Loader2, AlertCircle, RefreshCw,
  Link as LinkIcon, Key, Eye, EyeOff, Laptop, Copy, Check, ShieldCheck
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  created_at: string;
  show_prices?: boolean;
  max_devices?: number;
  status?: 'active' | 'suspended';
  pin_hash?: string | null;
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [usingMock, setUsingMock] = useState(false);

  // Form states
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  // Access Link Modal / Active Link State
  const [activeModalCust, setActiveModalCust] = useState<Customer | null>(null);
  const [custAccessUrl, setCustAccessUrl] = useState<string | null>(null);
  const [modalPinInput, setModalPinInput] = useState('');
  const [modalMaxDevices, setModalMaxDevices] = useState(2);
  const [copiedLink, setCopiedLink] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

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
        const seed = [
          { id: 'c1', name: 'سوبر ماركت الياسمين', created_at: new Date().toISOString(), show_prices: true, max_devices: 2 },
          { id: 'c2', name: 'بقالة النور', created_at: new Date().toISOString(), show_prices: false, max_devices: 2 },
          { id: 'c3', name: 'أسواق أورفا الغذائية', created_at: new Date().toISOString(), show_prices: true, max_devices: 3 }
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

    if (customers.some(c => c.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      alert('اسم الزبون هذا موجود بالفعل في القائمة.');
      return;
    }

    setIsUpdating(true);
    try {
      if (!usingMock) {
        const { data, error } = await supabase
          .from('customers')
          .insert({ 
            name: cleanName,
            show_prices: true,
            max_devices: 2
          })
          .select();

        if (error) throw error;
        if (data && data[0]) {
          setCustomers(prev => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name, 'ar')));
        }
      } else {
        const newCust: Customer = {
          id: 'local-' + Date.now(),
          name: cleanName,
          created_at: new Date().toISOString(),
          show_prices: true,
          max_devices: 2
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

  const handleToggleShowPrices = async (customer: Customer) => {
    const newStatus = !(customer.show_prices ?? true);
    setIsUpdating(true);

    try {
      if (!usingMock) {
        const res = await fetch('/api/admin/customers/price-visibility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId: customer.id, showPrices: newStatus })
        });

        if (!res.ok) throw new Error('فشل التحديث');
      } else {
        const updated = customers.map(c => c.id === customer.id ? { ...c, show_prices: newStatus } : c);
        localStorage.setItem('idlebi_customers', JSON.stringify(updated));
      }

      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, show_prices: newStatus } : c));
    } catch (err) {
      console.error('Error toggling show_prices:', err);
      alert('حدث خطأ في تغيير إعداد الأسعار.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenLinkModal = async (customer: Customer) => {
    setActiveModalCust(customer);
    setCustAccessUrl(null);
    setActionMsg('');
    setModalPinInput('');
    setModalMaxDevices(customer.max_devices ?? 2);

    try {
      const res = await fetch(`/api/admin/customers/access-link?customerId=${customer.id}`);
      const data = await res.json();
      if (res.ok) {
        setModalMaxDevices(data.maxDevices ?? 2);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateLink = async () => {
    if (!activeModalCust) return;
    setIsUpdating(true);
    setActionMsg('');

    try {
      const res = await fetch('/api/admin/customers/access-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: activeModalCust.id,
          pin: modalPinInput.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التوليد');

      setCustAccessUrl(data.accessUrl);
      setActionMsg('تم إنشاء رابط الدخول وتحديث البيانات بنجاح!');
      fetchCustomers();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'حدث خطأ أثناء إنشاء الرابط');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSavePinOnly = async () => {
    if (!activeModalCust || !modalPinInput.trim()) return;
    setIsUpdating(true);

    try {
      const res = await fetch('/api/admin/customers/access-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: activeModalCust.id,
          action: 'set_pin',
          pin: modalPinInput.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الحفظ');

      setActionMsg('تم تحديث رمز PIN الخاص بالزبون بنجاح!');
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ في حفظ PIN');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveMaxDevices = async () => {
    if (!activeModalCust) return;
    setIsUpdating(true);

    try {
      const res = await fetch('/api/admin/customers/access-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: activeModalCust.id,
          action: 'update_max_devices',
          maxDevices: modalMaxDevices
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التحديث');

      setActionMsg('تم تحديث الحد الأقصى للأجهزة بنجاح!');
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ في تحديث حد الأجهزة');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyLink = () => {
    if (!custAccessUrl) return;
    navigator.clipboard.writeText(custAccessUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRenameCustomer = async (id: string) => {
    const cleanName = tempName.trim();
    if (!cleanName) return;

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

      setCustomers(prev => prev.map(c => c.id === id ? { ...c, name: cleanName } : c));
      setEditingId(null);
    } catch (err: any) {
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
    } catch (err: any) {
      alert('حدث خطأ أثناء حذف الزبون.');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 dir-rtl font-sans text-right">
      {/* Offline Banner */}
      {usingMock && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
          <span>وضع العرض التجريبي لقائمة الزبائن نشط. يتم الحفظ محلياً.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">قائمة الزبائن وإدارتهم</h1>
          <p className="text-xs text-slate-500 mt-1">إنشاء الروابط الخاصة، تعيين PIN، التحكم بالأسعار وإدارة الأجهزة المعتمدة</p>
        </div>
        <button
          onClick={fetchCustomers}
          disabled={loading}
          className="p-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Add Customer */}
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
                className="w-full bg-slate-50 border border-slate-250 outline-none rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all font-bold"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isUpdating || !newName.trim()}
              className="w-full bg-[#128C7E] hover:bg-[#128C7E]/95 disabled:bg-slate-250 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isUpdating ? 'جاري الحفظ...' : 'حفظ الزبون في القائمة'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Manage Customers List */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-700" />
              <h2 className="text-sm font-bold text-slate-800">الزبائن المعتمدين والإعدادات</h2>
            </div>
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ابحث عن اسم زبون..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-250 outline-none rounded-xl pr-9 pl-4 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-bold">جاري تحميل قائمة الزبائن...</p>
            </div>
          ) : filteredCustomers.length > 0 ? (
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-1">
              {filteredCustomers.map((cust) => {
                const showPrices = cust.show_prices ?? true;

                return (
                  <div key={cust.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {editingId === cust.id ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          className="flex-1 bg-white border border-slate-300 outline-none rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameCustomer(cust.id)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl"
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800">{cust.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              showPrices ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {showPrices ? 'الأسعار ظاهرة' : 'الأسعار مخفية'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">الحد الأقصى للأجهزة: {cust.max_devices ?? 2}</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Toggle Show Prices */}
                          <button
                            onClick={() => handleToggleShowPrices(cust)}
                            disabled={isUpdating}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              showPrices 
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                            }`}
                            title="تبديل إظهار/إخفاء الأسعار للزبون"
                          >
                            {showPrices ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            <span>{showPrices ? 'إخفاء الأسعار' : 'إظهار الأسعار'}</span>
                          </button>

                          {/* Access Link & PIN Modal Trigger */}
                          <button
                            onClick={() => handleOpenLinkModal(cust)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="رابط الدخول و PIN"
                          >
                            <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                            <span>الرابط و PIN</span>
                          </button>

                          {/* Devices Link */}
                          <Link
                            href={`/admin/devices?customerId=${cust.id}`}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="إدارة أجهزة هذا الزبون"
                          >
                            <Laptop className="w-4 h-4" />
                          </Link>

                          {/* Edit Name */}
                          <button
                            onClick={() => {
                              setEditingId(cust.id);
                              setTempName(cust.name);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="تعديل الاسم"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Customer */}
                          <button
                            onClick={() => handleDeleteCustomer(cust.id, cust.name)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="حذف الزبون"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 space-y-2">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-xs font-bold text-slate-700">لا يوجد زبائن مطابقين</h3>
            </div>
          )}
        </div>
      </div>

      {/* Access Link & PIN Modal */}
      {activeModalCust && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">إدارة اعتماد: {activeModalCust.name}</h3>
              </div>
              <button 
                onClick={() => setActiveModalCust(null)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold">
                {actionMsg}
              </div>
            )}

            {/* Set / Update PIN */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700">تعيين / تحديث رمز PIN للزبون</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="أدخل 4-6 أرقام للـ PIN..."
                  value={modalPinInput}
                  onChange={(e) => setModalPinInput(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold outline-none"
                />
                <button
                  onClick={handleSavePinOnly}
                  disabled={!modalPinInput.trim() || isUpdating}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  حفظ PIN
                </button>
              </div>
            </div>

            {/* Max Devices */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700">الحد الأقصى للأجهزة المصرح بها</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={modalMaxDevices}
                  onChange={(e) => setModalMaxDevices(Number(e.target.value))}
                  className="w-24 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold outline-none"
                />
                <button
                  onClick={handleSaveMaxDevices}
                  disabled={isUpdating}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  تحديث الحد
                </button>
              </div>
            </div>

            {/* Generate & Copy Access Link */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleGenerateLink}
                disabled={isUpdating}
                className="w-full bg-[#128C7E] hover:bg-[#128C7E]/95 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <LinkIcon className="w-4 h-4" />
                <span>إنشاء رابط دخول جديد للزبون (يلغي الرابط القديم)</span>
              </button>

              {custAccessUrl && (
                <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-2">
                  <span className="block text-[10px] font-bold text-slate-400">رابط الدخول الخاص بالتنفيذ:</span>
                  <div className="flex items-center justify-between gap-2 bg-slate-800 p-2 rounded-xl text-xs font-mono break-all dir-ltr">
                    <span className="truncate">{custAccessUrl}</span>
                    <button
                      onClick={handleCopyLink}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg cursor-pointer shrink-0"
                      title="نسخ الرابط"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
