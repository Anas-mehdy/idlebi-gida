'use client';

import React, { useState, useEffect } from 'react';
import { 
  Laptop, Smartphone, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Ban, 
  Trash2, RefreshCw, Filter, Search, Loader2, UserCheck, UserX, Key, LogOut, Clock
} from 'lucide-react';

interface CustomerDevice {
  id: string;
  customer_id: string;
  device_name: string;
  browser: string;
  operating_system: string;
  user_agent: string;
  first_ip: string;
  last_ip: string;
  status: 'pending' | 'approved' | 'rejected' | 'blocked' | 'revoked';
  first_seen_at: string;
  last_seen_at: string;
  approved_at?: string;
  customers: {
    id: string;
    name: string;
    max_devices: number;
    status: 'active' | 'suspended';
    show_prices: boolean;
  };
}

export default function AdminDevicesPage() {
  const [devices, setDevices] = useState<CustomerDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const url = filterStatus !== 'all' 
        ? `/api/admin/devices?status=${filterStatus}`
        : '/api/admin/devices';
        
      const res = await fetch(url);
      const data = await res.json();
      
      if (res.ok) {
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [filterStatus]);

  const handleDeviceAction = async (deviceId: string, action: string, customerId?: string) => {
    setProcessingId(deviceId);
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, action, customerId })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'حدث خطأ في إجراء الجهاز');
        return;
      }

      // Refresh list
      fetchDevices();
    } catch (err) {
      console.error(err);
      alert('حدث خطأ غير متوقع');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredDevices = devices.filter((d) => 
    d.customers.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.device_name && d.device_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (d.browser && d.browser.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pendingCount = devices.filter(d => d.status === 'pending').length;

  return (
    <div className="space-y-6 dir-rtl font-sans text-right">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>إدارة أجهزة الزبائن</span>
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                {pendingCount} طلبات معلقة
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-1">اعتماد وحظر وتتبع الأجهزة والمتصفحات المصرح لها بالدخول للمتجر</p>
        </div>

        <button
          onClick={fetchDevices}
          disabled={loading}
          className="p-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5 text-xs font-bold w-fit"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث القائمة</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'pending', label: 'بانتظار الاعتماد' },
            { id: 'approved', label: 'معتمدة' },
            { id: 'blocked', label: 'محظورة' },
            { id: 'rejected', label: 'مرفوضة' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                filterStatus === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ابحث عن اسم زبون أو متصفح..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 outline-none rounded-xl pr-9 pl-4 py-2 text-xs text-slate-800 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all"
          />
        </div>
      </div>

      {/* Devices List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs font-bold">جاري تحميل قائمة الأجهزة...</p>
        </div>
      ) : filteredDevices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device) => {
            const isPending = device.status === 'pending';
            const isApproved = device.status === 'approved';
            const isBlocked = device.status === 'blocked';
            const isRejected = device.status === 'rejected';

            return (
              <div 
                key={device.id} 
                className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 transition-all relative ${
                  isPending ? 'border-amber-300 ring-2 ring-amber-500/10' : 'border-slate-200'
                }`}
              >
                {/* Header Info */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-800">{device.customers.name}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                      الحد الأقصى للأجهزة: {device.customers.max_devices}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${
                    isApproved ? 'bg-emerald-100 text-emerald-800' :
                    isPending ? 'bg-amber-100 text-amber-800' :
                    isBlocked ? 'bg-rose-100 text-rose-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                    {isPending && <Clock className="w-3 h-3 text-amber-600 animate-spin" />}
                    {isBlocked && <Ban className="w-3 h-3 text-rose-600" />}
                    <span>
                      {isApproved ? 'معتمد' : isPending ? 'بانتظار الموافقة' : isBlocked ? 'محظور' : isRejected ? 'مرفوض' : 'ملغى'}
                    </span>
                  </span>
                </div>

                {/* Device Spec details */}
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-bold text-slate-700">{device.device_name || 'متصفح'}</span>
                    <span className="text-[11px] text-slate-400">({device.operating_system} - {device.browser})</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>IP الأول: {device.first_ip || 'غير معروف'}</span>
                    <span>آخر ظهور: {new Date(device.last_seen_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {isPending && (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => handleDeviceAction(device.id, 'approve', device.customer_id)}
                        disabled={processingId === device.id}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>اعتماد الجهاز</span>
                      </button>
                      <button
                        onClick={() => handleDeviceAction(device.id, 'reject')}
                        disabled={processingId === device.id}
                        className="px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold py-2 rounded-xl text-xs transition-all cursor-pointer"
                      >
                        رفض
                      </button>
                    </div>
                  )}

                  {isApproved && (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => handleDeviceAction(device.id, 'revoke')}
                        disabled={processingId === device.id}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 rounded-xl text-xs transition-all cursor-pointer"
                      >
                        إلغاء الاعتماد
                      </button>
                      <button
                        onClick={() => handleDeviceAction(device.id, 'block')}
                        disabled={processingId === device.id}
                        className="px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold py-1.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1"
                        title="حظر الجهاز"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>حظر</span>
                      </button>
                    </div>
                  )}

                  {(isBlocked || isRejected) && (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => handleDeviceAction(device.id, 'approve', device.customer_id)}
                        disabled={processingId === device.id}
                        className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold py-1.5 rounded-xl text-xs transition-all cursor-pointer"
                      >
                        فك الحظر واعتماد
                      </button>
                      <button
                        onClick={() => handleDeviceAction(device.id, 'delete')}
                        disabled={processingId === device.id}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف الجهاز"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
          <Laptop className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">لا توجد أجهزة مطابقة</h3>
          <p className="text-xs text-slate-400">لم يتم العثور على أجهزة تسجلت بهذا الفلتر بعد.</p>
        </div>
      )}
    </div>
  );
}
