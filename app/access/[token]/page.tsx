'use client';

import React, { useState, useEffect, use } from 'react';
import { ShieldCheck, AlertCircle, Loader2, FileWarning, UserX } from 'lucide-react';

export default function AccessTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorTitle, setErrorTitle] = useState('رابط الدخول غير صالح');
  const [httpStatus, setHttpStatus] = useState<number | null>(null);

  useEffect(() => {
    async function verifyAndRegister() {
      try {
        setLoading(true);
        setErrorMsg('');

        // Detect device metadata
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        let browser = 'غير معروف';
        let os = 'غير معروف';

        if (ua.includes('Chrome') && !ua.includes('Edge')) browser = 'Chrome';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Edge')) browser = 'Edge';

        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
        else if (ua.includes('Mac')) os = 'macOS';

        const backupToken = typeof window !== 'undefined' ? localStorage.getItem('customer_device_backup_token') : null;
        const backupPendingToken = typeof window !== 'undefined' ? localStorage.getItem('customer_pending_backup_token') : null;

        const res = await fetch('/api/access/verify-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            token,
            deviceName: `${os} - ${browser}`,
            browser,
            os,
            backupToken,
            backupPendingToken
          })
        });

        setHttpStatus(res.status);

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

        // Store backup pending or session token in localStorage to safeguard against Safari ITP
        if (data.pendingToken) {
          localStorage.setItem('customer_pending_backup_token', data.pendingToken);
        }
        if (data.sessionToken) {
          localStorage.setItem('customer_device_backup_token', data.sessionToken);
        }

        if (data.alreadyApproved === true) {
          window.location.href = data.redirectTo || '/';
          return;
        }

        // Redirect to status page (pending approval or limit reached)
        window.location.href = data.redirectTo || '/access/status?reason=pending';
      } catch (err: any) {
        console.error('Network or client error verifying link:', err);
        setErrorTitle('خطأ في الاتصال');
        setErrorMsg(err.message || 'تعذر الاتصال بالمخدم للتحقق من الرابط.');
      } finally {
        setLoading(false);
      }
    }

    verifyAndRegister();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-right" dir="rtl">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-4 max-w-sm w-full">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-black text-slate-800">جاري التحقق وتسجيل الجهاز...</h2>
            <p className="text-xs text-slate-400">يرجى الانتظار لحظة واحدة</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans text-right" dir="rtl">
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
          <p className="text-xs text-slate-400">يرجى التواصل مع إدارة المتجر للحصول على رابط جديد.</p>
        </div>
      </div>
    </div>
  );
}
