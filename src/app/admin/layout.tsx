"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  {
    label: "想法管理",
    href: "/admin",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: "项目设置",
    href: "/admin/settings",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [inputToken, setInputToken] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("cobuilder_admin_token");
    if (stored) {
      setToken(stored);
    }
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
        <div className="w-full max-w-sm">
          <div className="bg-paper rounded-xl border border-border p-8 shadow-sm animate-fade-in">
            <div className="text-center mb-6">
              <Link href="/" className="font-serif text-2xl font-bold text-gold">
                CoBuilder
              </Link>
              <p className="text-sm text-muted mt-2">管理员登录</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  管理密码
                </label>
                <input
                  type="password"
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  placeholder="请输入管理密码"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-lg bg-cream border border-border text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all"
                />
              </div>
              {authError && (
                <p className="text-sm text-red-500">{authError}</p>
              )}
              <button
                type="submit"
                disabled={!inputToken.trim()}
                className="w-full bg-gold hover:bg-gold-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-all"
              >
                登录
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-56 bg-paper border-r border-border flex flex-col transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}
        <div className="px-4 h-14 flex items-center border-b border-border">
          <Link href="/admin" className="font-serif text-lg font-bold text-gold" onClick={() => setSidebarOpen(false)}>
            CoBuilder
          </Link>
          <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium bg-gold/10 text-gold">
            管理
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gold/10 text-gold"
                    : "text-muted hover:text-ink hover:bg-cream"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            退出登录
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-cream/80 backdrop-blur-sm border-b border-border h-14 flex items-center px-4 sm:px-6 gap-4">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-paper transition-colors"
          >
            <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="font-serif text-base font-bold text-ink">
            {NAV_ITEMS.find((item) =>
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href)
            )?.label || "管理后台"}
          </h1>
          <div className="flex-1" />
          <Link
            href="/"
            className="text-sm text-muted hover:text-ink transition-colors"
          >
            查看前台
          </Link>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
