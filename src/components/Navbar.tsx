import Link from "next/link";

interface NavbarProps {
  showAdmin?: boolean;
  showBack?: boolean;
  backHref?: string;
  backLabel?: string;
  rightSlot?: React.ReactNode;
}

export default function Navbar({
  showAdmin = true,
  showBack = false,
  backHref = "/",
  backLabel = "返回",
  rightSlot,
}: NavbarProps) {
  return (
    <nav className="navbar-glass fixed top-0 left-0 right-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          {showBack && (
            <Link
              href={backHref}
              className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
          )}
          <Link
            href="/"
            className="font-serif text-lg font-bold text-gold hover:text-gold-light transition-colors"
          >
            CoBuilder
          </Link>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1">
          {rightSlot}
          {showAdmin && (
            <>
              <Link
                href="/submit"
                className="btn btn-ghost text-sm px-3 py-1.5 text-muted hover:text-ink"
              >
                提交需求
              </Link>
              <Link
                href="/admin"
                className="btn btn-secondary text-sm px-3 py-1.5"
              >
                管理后台
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
