"use client";

import React from "react";

const TABS = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待澄清" },
  { key: "clarified", label: "已澄清" },
  { key: "in_progress", label: "进行中" },
  { key: "published", label: "已实现" },
  { key: "deferred", label: "搁置" },
] as const;

interface FilterBarProps {
  active: string;
  counts: Record<string, number>;
  onChange: (status: string) => void;
}

export default function FilterBar({ active, counts, onChange }: FilterBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const count = tab.key === "all" ? counts.all ?? Object.values(counts).reduce((a, b) => a + b, 0) : (counts[tab.key] ?? 0);

        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
              isActive
                ? "bg-[#8B6914] text-white"
                : "bg-white text-[#2C2C2C] border border-[#E8E4DE] hover:bg-gray-50"
            }`}
          >
            {tab.label}
            {count > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
