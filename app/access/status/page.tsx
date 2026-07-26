'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldAlert, Clock, Ban, UserX, Store, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function StatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reason = searchParams.get('reason') || 'unauthorized';

  const [checking, setChecking] = useState(false);
  const [autoApproved, setAutoApproved] = useState(false);

  // Function to re-check if device has been approved by admin
  const checkStatusNow = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/access/status');
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        console.error('Error parsing device status JSON:', e);
      }

      if (data && data.approved === true) {
        setAutoApproved(true);
        setTimeout(() => {
          window.location.href = data.redirectTo || '/';
        }, 1000);
      } else if (data && data.redirectUrl && data.status !== 'pending') {
        window.location.href = data.redirectUrl;
      }
    } catch (err) {
      console.log('Device check failed or pending.', err);
    } finally {
      setChecking(false);
    }
  };

  // Poll status every 10 seconds if pending
  useEffect(() => {
    if (reason === 'pending') {
      const interval = setInterval(() => {
        checkStatusNow();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [reason]);

  if (autoApproved) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-emerald-200 shadow-xl text-center space-y-4 max-w-md w-full">
        <div className="w-14 h-14 bg-emerald-100 rounded-2xl text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-8 h-8 animate-bounce" />
        </div>
        <h1 className="text-lg font-bold text-slate-800">تمت موافقة الإدارة على جهازك!</h1>
        <p className="text-xs text-slate-500">جاري توجيهك إلى المتجر تلقائياً...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-6 max-w-md w-full">
      {reason === 'pending' && (
        <>
          <div className="w-16 h-16 bg-amber-50 border border-amber-200/70 rounded-3xl text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <span className="inline-block text-[11px] font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
              طلب جهاز جديد معلق
            </span>
            <h1 className="text-xl font-black text-slate-800">بانتظار موافقة الأدمن</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              تم تسجيل متصفحك بنجاح. سيتم فتح المتجر تلقائياً فور اعتماد الإدارة لطلبك.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={checkStatusNow}
              disabled={checking}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'جاري الفحص...' : 'فحص التفعيل الآن'}</span>
            </button>
          </div>
        </>
      )}

      {reason === 'unauthorized' && (
        <>
          <div className="w-16 h-16 bg-blue-50 border border-blue-200/70 rounded-3xl text-blue-600 flex items-center justify-center mx-auto shadow-sm">
            <Store className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-800">المتجر خاص بالزبائن المعتمدين</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              عذراً، هذا المتجر متاح فقط للزبائن المعتمدين عبر روابط دخول خاصة ومستقلة.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 text-right space-y-1">
            <p className="font-bold text-slate-700">كيف أحصل على صلاحية الوصول؟</p>
            <p className="text-[11px] text-slate-500">
              تواصل مع إدارة المتجر للحصول على رابطك الخاص وإدخال الـ PIN واعتماد جهازك.
            </p>
          </div>
        </>
      )}

      {reason === 'rejected' && (
        <>
          <div className="w-16 h-16 bg-rose-50 border border-rose-200/70 rounded-3xl text-rose-600 flex items-center justify-center mx-auto shadow-sm">
            <Ban className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-800">تم رفض اعتماد هذا الجهاز</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              اعتذار، لقد رفضت الإدارة طلب اعتماد هذا المتصفح. يرجى التواصل مع الدعم.
            </p>
          </div>
        </>
      )}

      {reason === 'blocked' && (
        <>
          <div className="w-16 h-16 bg-rose-100 border border-rose-300 rounded-3xl text-rose-700 flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-800">تم حظر الوصول من هذا الجهاز</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              تم إدراج هذا الجهاز ضمن الأجهزة المحظورة من الوصول للمتجر.
            </p>
          </div>
        </>
      )}

      {reason === 'suspended' && (
        <>
          <div className="w-16 h-16 bg-amber-50 border border-amber-200/70 rounded-3xl text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <UserX className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-800">حساب الزبون موقوف مؤقتاً</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              حسابك موقوف من قبل الإدارة، يرجى التواصل مع قسم المبيعات لتفعيل الحساب.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default function AccessStatusPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans dir-rtl">
      <Suspense fallback={
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-4 max-w-md w-full">
          <p className="text-xs text-slate-500 font-bold">جاري تحميل الحالة...</p>
        </div>
      }>
        <StatusContent />
      </Suspense>
    </div>
  );
}
