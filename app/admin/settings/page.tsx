'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save, AlertCircle, CheckCircle2, Loader2, Phone } from 'lucide-react';

export default function AdminSettings() {
  const [rawNumber, setRawNumber] = useState('');
  const [sanitizedNumber, setSanitizedNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Sanitization Helper Function
  // 1. Strip all spaces and "+".
  // 2. Remove leading "0" if "05xxxxxxxx" (turns into "5xxxxxxxx").
  // 3. Prefix with "90" if not already present, ensuring format: "905xxxxxxxx".
  const sanitizePhoneNumber = (input: string): string => {
    // Strip all non-digit characters (including spaces, +)
    let cleaned = input.replace(/\D/g, '');

    // Check if it starts with 0
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1); // Remove leading 0
    }

    // Now, if it starts with 905, it is already correct.
    // If it starts with 5, prepend 90.
    if (cleaned.startsWith('5') && cleaned.length === 10) {
      cleaned = '90' + cleaned;
    } else if (cleaned.startsWith('905') && cleaned.length === 12) {
      // Correct format
    } else if (cleaned.length > 0 && !cleaned.startsWith('90')) {
      // Default to adding country code if it looks like a standard number without it
      cleaned = '90' + cleaned;
    }

    return cleaned;
  };

  useEffect(() => {
    // Dynamic real-time preview of sanitization
    setSanitizedNumber(sanitizePhoneNumber(rawNumber));
  }, [rawNumber]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setStatusMsg(null);
      
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      if (!isUrlConfigured) {
        throw new Error('Supabase environment variables not configured');
      }

      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'whatsapp_number')
        .single();

      if (error) {
        // If row doesn't exist, seed it
        if (error.code === 'PGRST116') {
          await supabase.from('settings').insert({ key: 'whatsapp_number', value: '905000000000' });
          setRawNumber('905000000000');
        } else {
          throw error;
        }
      } else if (data && data.value) {
        setRawNumber(data.value);
      }
      
      setUsingMockData(false);
    } catch (err) {
      console.warn('Could not fetch settings from database. Loading preview mode.', err);
      setRawNumber('905000000000');
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    // Validate sanitized number format
    if (!/^905\d{9}$/.test(sanitizedNumber)) {
      setStatusMsg({
        type: 'error',
        text: 'صيغة رقم الهاتف غير صالحة. يجب أن يتكون الرقم التركي من 12 خانة ويبدأ بـ 905 (مثال: 905300000000).'
      });
      return;
    }

    setSaving(true);

    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

      if (isUrlConfigured) {
        const { error } = await supabase
          .from('settings')
          .upsert({ key: 'whatsapp_number', value: sanitizedNumber });

        if (error) throw error;
      }

      setStatusMsg({
        type: 'success',
        text: 'تم حفظ رقم الواتساب وتحديث رابط الطلبات بنجاح!'
      });
      setRawNumber(sanitizedNumber);
    } catch (err: any) {
      console.error(err);
      setStatusMsg({
        type: 'error',
        text: err.message || 'حدث خطأ أثناء حفظ الإعدادات.'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning */}
      {usingMockData && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
          <span>وضع العرض التجريبي نشط. التعديلات ستتم محاكاة حفظها محلياً فقط.</span>
        </div>
      )}

      {/* Header Info */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">إعدادات النظام العامة</h1>
        <p className="text-xs text-slate-500 mt-1">تعديل رقم الهاتف المستلم لطلبات الواتساب وتخصيص قنوات التوجيه للمبيعات</p>
      </div>

      <div className="max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <Settings className="w-5 h-5 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-800">قناة استلام الطلبات (WhatsApp)</h2>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-550" />
            <p className="text-xs font-bold">جاري تحميل الإعدادات...</p>
          </div>
        ) : (
          <form onSubmit={handleSaveSettings} className="space-y-6">
            
            {/* Input field */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-600">رقم الهاتف المستلم</label>
              
              <div className="relative">
                <span className="absolute inset-y-0 right-3.5 flex items-center text-slate-400">
                  <Phone className="w-4.5 h-4.5" />
                </span>
                
                <input
                  type="text"
                  required
                  value={rawNumber}
                  onChange={(e) => setRawNumber(e.target.value)}
                  placeholder="أدخل رقم الواتساب (مثال: +90 530 000 00 00)"
                  className="w-full bg-slate-50 border border-slate-250 outline-none rounded-xl pr-10 pl-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-right ltr"
                  disabled={saving}
                />
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed">
                * يمكنك إدخال الرقم بأي صيغة (مع فراغات، مع إشارة +، أو بالبدء بـ 0). سيقوم النظام تلقائياً بتنظيف المدخلات وتنسيقها بالشكل الدولي المعتمد لدى شركة واتساب.
              </p>
            </div>

            {/* Live Sanitize Dynamic Preview Card */}
            {rawNumber && (
              <div className="bg-slate-55 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-600">المعالجة التلقائية الذكية:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-400 block mb-0.5">القيمة التي قمت بكتابتها:</span>
                    <span className="font-mono text-slate-700 font-medium">{rawNumber}</span>
                  </div>
                  <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200">
                    <span className="text-emerald-700 block mb-0.5">الصيغة النهائية للحفظ (wa.me):</span>
                    <span className="font-mono text-emerald-600 font-extrabold">{sanitizedNumber || 'جاري المعالجة...'}</span>
                  </div>
                </div>
                {sanitizedNumber && (
                  <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                    رابط الطلب المباشر النشط للمتجر: <span className="font-mono text-emerald-600 underline select-all">https://wa.me/{sanitizedNumber}</span>
                  </div>
                )}
              </div>
            )}

            {/* Notification alert */}
            {statusMsg && (
              <div className={`p-4 rounded-2xl text-xs flex items-start gap-2.5 font-semibold leading-relaxed border ${
                statusMsg.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-rose-55 border-rose-200 text-rose-800'
              }`}>
                {statusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                )}
                <span>{statusMsg.text}</span>
              </div>
            )}

            {/* Action button */}
            <button
              type="submit"
              disabled={saving || !rawNumber}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-3 px-5 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4.5 h-4.5" />
              )}
              <span>حفظ التعديلات</span>
            </button>

          </form>
        )}
      </div>
    </div>
  );
}
