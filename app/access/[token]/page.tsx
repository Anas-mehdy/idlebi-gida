'use client';

import React, { useState, useEffect, use } from 'react';
import { ShieldCheck, Lock, Store, AlertCircle, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function AccessTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function verifyLink() {
      try {
        setLoading(true);
        setErrorMsg('');

        const res = await fetch('/api/access/verify-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'رابط الدخول غير صالح أو تم إلغاؤه.');
        }

        setCustomerName(data.customerName || 'زبون معتمد');
        setHasPin(data.hasPin);
      } catch (err: any) {
        console.error('Error verifying link:', err);
        setErrorMsg(err.message || 'حدث خطأ في التحقق من رابط الدخول.');
      } finally {
        setLoading(false);
      }
    }

    verifyLink();
  }, [token]);

  const handleSubmitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      // Basic device info
      const ua = navigator.userAgent;
      let browser = 'غير معروف';
      let os = 'غير معروف';

      if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Safari')) browser = 'Safari';
      else if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Edge')) browser = 'Edge';

      if (ua.includes('Windows')) os = 'Windows';
      else if (ua.includes('Android')) os = 'Android';
      else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
      else if (ua.includes('Mac')) os = 'macOS';

      const res = await fetch('/api/access/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          pin: pin.trim(),
          deviceName: `${os} - ${browser}`,
          browser,
          os
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'فشل التحقق من رمز PIN');
      }

      // Redirect to status page pending approval
      window.location.href = '/access/status?reason=pending';
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء التأكيد.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-right">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-lg text-center space-y-4 max-w-sm w-full">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
          <h2 className="text-sm font-bold text-slate-800">جاري التحقق من رابط الدخول...</h2>
        </div>
      </div>
    );
  }

  if (errorMsg && !customerName) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-right dir-rtl">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-5 max-w-md w-full">
          <div className="w-14 h-14 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 flex items-center justify-center mx-auto shadow-sm">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-slate-800">رابط الدخول غير صالح</h1>
            <p className="text-xs text-slate-500 leading-relaxed">{errorMsg}</p>
          </div>
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400">يرجى التواصل مع إدارة المتجر للحصول على رابط دخول جديد.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans dir-rtl">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
        {/* Header Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-emerald-50 border border-emerald-200/60 rounded-2xl text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <span className="inline-block text-[11px] font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
            تأكيد اعتماد المتصفح
          </span>
          <h1 className="text-xl font-black text-slate-800">أهلاً بك، {customerName}</h1>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            أدخل رمز PIN الخاص بك لتسجيل هذا الجهاز بانتظار موافقة الأدمن
          </p>
        </div>

        {/* PIN Form */}
        <form onSubmit={handleSubmitPin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">رمز PIN الخاص بحسابك</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-3.5 flex items-center text-slate-400">
                <Lock className="w-4.5 h-4.5" />
              </span>
              <input
                type="password"
                required
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="أدخل الـ PIN هنا..."
                className="w-full bg-slate-50 border border-slate-250 outline-none rounded-xl pr-10 pl-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-center tracking-widest font-bold"
                disabled={submitting}
                autoFocus
              />
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-start gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !pin.trim()}
            className="w-full bg-[#128C7E] hover:bg-[#128C7E]/95 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري تسجيل الجهاز...</span>
              </>
            ) : (
              <span>تأكيد وتسجيل الجهاز</span>
            )}
          </button>
        </form>

        <div className="border-t border-slate-100 pt-4 text-center">
          <p className="text-[11px] text-slate-400">
            هذا النظام محمي. يطلب PIN عند أول دخول لكل متصفح جديد فقط.
          </p>
        </div>
      </div>
    </div>
  );
}
