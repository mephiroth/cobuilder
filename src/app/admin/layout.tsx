"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  {
    label: "需求管理",
    href: "/admin",
    exact: true,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: "项目设置",
    href: "/admin/settings",
    exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [inputToken, setInputToken] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("cobuilder_admin_token");
    if (stored) setToken(stored);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${inputToken}` },
      });
      if (res.ok) {
        localStorage.setItem("cobuilder_admin_token", inputToken);
        setToken(inputToken);
      } else {
        setAuthError("密码错误，请重试");
      }
    } catch {
      setAuthError("连接失败，请重试");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("cobuilder_admin_token");
    setToken(null);
    router.push("/");
  };

  // Auth gate
  if (!token) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="w-full max-w-sm animate-fade-in-scale">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="font-serif text-2xl font-bold text-gold">
              CoBuilder
            </Link>
            <p className="text-sm text-muted mt-1">管理后台</p>
          </div>

          <div className="card p-8">
            <h1 className="font-serif text-xl font-bold text-ink mb-1">登录</h1>
            <p className="text-sm text-muted mb-6">请输入管理密码继续</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">管理密码</label>
                <input
                  type="password"
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  className="input-base"
                />
              </div>
              {authError && (
                <div className="flex items-center gap-2 text-sm text-error">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {authError}
                </div>
              )}
              <button
                type="submit"
                disabled={!inputToken.trim()}
                className="btn btn-primary w-full py-2.5 text-sm font-semibold"
              >
                登录
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-border text-center">
              <Link href="/" className="text-sm text-muted hover:text-ink transition-colors">
                返回前台
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentNavItem = NAV_ITEMS.find((item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)
  );

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-60 bg-paper border-r border-border flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}
        <div className="px-5 h-14 flex items-center gap-2 border-b border-border flex-shrink-0">
          <Link
            href="/admin"
            className="font-serif text-lg font-bold text-gold hover:text-gold-light transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            CoBuilder
          </Link>
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-gold-subtle text-gold border border-gold-border">
            管理
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-muted-light uppercase tracking-wider px-3 mb-2">
            主菜单
          </p>
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border flex-shrink-0 space-y-1">
          <Link
            href="/"
            className="sidebar-nav-item text-xs"
            onClick={() => setSidebarOpen(false)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            查看前台
          </Link>
          <button
            onClick={handleLogout}
            className="sidebar-nav-item w-full text-xs hover:text-error hover:bg-red-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            退出登录
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur-sm border-b border-border h-14 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
            aria-label="打开菜单"
          >
            <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted hidden sm:inline">管理后台</span>
            {currentNavItem && (
              <>
                <span className="text-border hidden sm:inline">/</span>
                <span className="font-medium text-ink">{currentNavItem.label}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          <Link
            href="/"
            className="btn btn-ghost text-xs px-3 py-1.5 text-muted"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            前台
          </Link>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
