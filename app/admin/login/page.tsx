'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Store, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // If already logged in, redirect straight to admin
  useEffect(() => {
    async function checkActiveSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        document.cookie = "admin_session=authenticated; path=/; max-age=86400; SameSite=Strict";
        router.push('/admin');
      }
    }
    checkActiveSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      
      if (!isUrlConfigured) {
        // Fallback for Demo mode
        if (email === 'admin@idelbi.com' && password === 'admin123') {
          document.cookie = "admin_session=authenticated; path=/; max-age=86400; SameSite=Strict";
          router.push('/admin');
          return;
        } else {
          throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة (في الوضع التجريبي استخدم: admin@idelbi.com / admin123)');
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) throw error;

      if (data.session) {
        // Set the middleware cookie
        document.cookie = "admin_session=authenticated; path=/; max-age=86400; SameSite=Strict";
        router.push('/admin');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center min-h-screen bg-slate-50 px-4 font-sans text-right relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-550/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-550/5 rounded-full blur-3xl -z-10" />

      <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-200 shadow-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex bg-emerald-50 p-4 rounded-2xl text-emerald-600 border border-emerald-200/50 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800">لوحة الإدارة - idelbi gida</h1>
          <p className="text-xs text-slate-500 font-medium">سجل الدخول لإدارة الكتالوج وتجهيز الطلبيات</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 right-3.5 flex items-center text-slate-400">
                <Mail className="w-4.5 h-4.5" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@idelbi.com"
                className="w-full bg-slate-50 border border-slate-250 outline-none rounded-xl pr-10 pl-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-right"
                disabled={loading}
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600">
              كلمة المرور
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 right-3.5 flex items-center text-slate-400">
                <Lock className="w-4.5 h-4.5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-250 outline-none rounded-xl pr-10 pl-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-right"
                disabled={loading}
              />
            </div>
          </div>

          {/* Errors alert */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs flex items-start gap-2.5 font-semibold leading-relaxed">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] cursor-pointer animate-pulse"
          >
            <span>{loading ? 'جاري التحقق...' : 'تسجيل الدخول'}</span>
          </button>
        </form>

        <div className="border-t border-slate-100 pt-4 flex items-center justify-center">
          <Link
            href="/"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
          >
            <ArrowRight className="w-4 h-4 text-emerald-600" />
            <span>العودة إلى كتالوج الزبائن الرئيسي</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
