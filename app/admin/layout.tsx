'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { LayoutDashboard, FolderKanban, ShoppingBag, Settings, LogOut, Store, Menu, X, User, TrendingUp } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('المشرف');
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Authenticated user session guard
  useEffect(() => {
    if (pathname === '/admin/login') {
      setCheckingAuth(false);
      return;
    }

    async function checkSession() {
      try {
        const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
        
        if (!isUrlConfigured) {
          // Bypassed session check in Demo mode
          setAdminEmail('admin@idelbi.com');
          setCheckingAuth(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Force delete cookie and redirect
          document.cookie = "admin_session=; path=/; max-age=0; SameSite=Strict";
          router.push('/admin/login');
        } else {
          setAdminEmail(session.user.email || 'المشرف');
          setCheckingAuth(false);
        }
      } catch (err) {
        console.error(err);
      }
    }
    checkSession();
  }, [router, pathname]);

  const handleLogout = async () => {
    try {
      const isUrlConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
      if (isUrlConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear cookie and redirect
      document.cookie = "admin_session=; path=/; max-age=0; SameSite=Strict";
      router.push('/admin/login');
    }
  };

  const navLinks = [
    { href: '/admin', label: 'لوحة التحكم والطلبات', icon: LayoutDashboard },
    { href: '/admin/categories', label: 'إدارة الأقسام', icon: FolderKanban },
    { href: '/admin/products', label: 'إدارة المنتجات', icon: ShoppingBag },
    { href: '/admin/settings', label: 'إعدادات الواتساب', icon: Settings },
    { href: '/admin/statistics', label: 'الإحصائيات والأرشيف', icon: TrendingUp },
  ];

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (checkingAuth) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-900 font-sans text-emerald-400">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold">جاري التحقق من الصلاحيات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow flex min-h-screen bg-slate-950 text-slate-200 font-sans text-right">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar navigation */}
      <aside 
        className={`fixed top-0 bottom-0 right-0 w-64 bg-slate-900 border-l border-slate-800 z-50 transition-transform duration-300 lg:translate-x-0 lg:static flex flex-col ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-400 border border-emerald-500/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-md font-bold text-white leading-none">إدلب غداء</h2>
              <span className="text-[10px] text-emerald-400 font-medium">لوحة الإدارة</span>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/10'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-850 rounded-xl border border-slate-800/80">
            <User className="w-4.5 h-4.5 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{adminEmail}</p>
              <p className="text-[9px] text-slate-400">حساب المشرف</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main content layout wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-slate-900 border-b border-slate-800 h-16 flex items-center justify-between px-6 shrink-0 lg:justify-end">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <Link
            href="/"
            target="_blank"
            className="text-xs font-bold text-emerald-400 hover:text-white bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2"
          >
            <Store className="w-4 h-4" />
            <span>معاينة المتجر العام</span>
          </Link>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
