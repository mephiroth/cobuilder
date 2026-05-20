import React from "react";
import Link from "next/link";

interface NavbarProps {
  adminLink?: boolean;
}

export default function Navbar({ adminLink }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#E8E4DE] shadow-sm">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="font-serif text-xl font-bold text-[#8B6914] hover:text-[#6B5010] transition-colors">
            CoBuilder
          </Link>

          <div className="flex items-center gap-4">
            {adminLink && (
              <Link
                href="/admin"
                className="text-sm font-medium text-[#2C2C2C] hover:text-[#8B6914] transition-colors"
              >
                管理后台
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
