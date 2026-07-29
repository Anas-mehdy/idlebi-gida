'use client';

import React, { useState, useEffect, use } from 'react';
import { ShieldCheck, Lock, AlertCircle, Loader2, FileWarning, UserX, Ban } from 'lucide-react';

export default function AccessTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorTitle, setErrorTitle] = useState('رابط الدخول غير صالح');
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
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

        setHttpStatus(res.status);

        // Safe response parsing: read text first to prevent JSON parse crashes
        const responseText = await res.text();
        let data: any = null;
        try {
          data = responseText ? JSON.parse(responseText) : null;
        } catch (parseErr) {
          console.error('Failed to parse JSON response from verify-link API:', parseErr, responseText);
        }

        if (!data) {
          setErrorTitle('خطأ في الاستجابة');
          setErrorMsg('تلقى المتصفح رداً غير متوقع أو فارغاً من المخدم.');
          return;
        }

        if (!res.ok || !data.success) {
          if (res.status === 404) {
            setErrorTitle('رابط غير موجود');
            setErrorMsg(data.error || 'رابط الدخول الخاص غير موجود، يرجى التأكد من الرمز المستعمل.');
          } else if (res.status === 410) {
            setErrorTitle('رابط ملغى أو منتهي');
            setErrorMsg(data.error || 'رابط الدخول هذا تم إبطاله أو انتهت صلاحيته.');
          } else if (res.status === 403) {
            setErrorTitle('حساب موقوف');
            setErrorMsg(data.error || 'حساب هذا الزبون موقوف حالياً من قبل الإدارة.');
          } else if (res.status === 500) {
            setErrorTitle('خطأ تقني في المخدم');
            setErrorMsg(data.error || 'حدث خطأ تقني داخلي أثناء فحص الرابط.');
          } else {
            setErrorTitle('تعذر الدخول');
            setErrorMsg(data.error || 'حدث خطأ أثناء فحص صلاحية رابط الدخول.');
          }
          return;
        }

        if (data.alreadyApproved === true) {
          window.location.href = data.redirectTo || '/';
          return;
        }

        setCustomerName(data.customerName || 'زبون معتمد');
        setHasPin(data.hasPin);
      } catch (err: any) {
        console.error('Network or client error verifying link:', err);
        setErrorTitle('خطأ في الاتصال');
        setErrorMsg(err.message || 'تعذر الاتصال بالمخدم للتحقق من الرابط.');
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

      const responseText = await res.text();
      let data: any = null;
      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch (parseErr) {
        console.error('Failed to parse JSON response from verify-pin API:', parseErr, responseText);
      }

      if (!data) {
        throw new Error('تلقى المتصفح رداً غير متوقع أثناء تأكيد الـ PIN.');
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'رمز PIN غير صحيح أو فشل الاعتماد.');
      }

      // Redirect to status page pending approval or limit reached
      if (data.status === 'limit_reached' || data.isOverLimit) {
        window.location.href = `/access/status?reason=limit_reached&approved=${data.approvedCount || 0}&max=${data.maxDevices || 2}`;
      } else {
        window.location.href = '/access/status?reason=pending';
      }
    } catch (err: any) {
      console.error('Error submitting PIN:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء التأكيد.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-right dir-rtl">
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
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-sm border ${
            httpStatus === 410 ? 'bg-amber-50 border-amber-200 text-amber-600' :
            httpStatus === 403 ? 'bg-orange-50 border-orange-200 text-orange-600' :
            'bg-rose-50 border-rose-200 text-rose-600'
          }`}>
            {httpStatus === 410 ? <FileWarning className="w-7 h-7" /> :
             httpStatus === 403 ? <UserX className="w-7 h-7" /> :
             <AlertCircle className="w-7 h-7" />}
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-slate-800">{errorTitle}</h1>
            <p className="text-xs text-slate-500 leading-relaxed">{errorMsg}</p>
          </div>
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400">يرجى التواصل مع إدارة المتجر للحصول على مساعدة.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans dir-rtl">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
        {/* Header */}
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
