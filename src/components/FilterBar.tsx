"use client";

interface FilterTab {
  key: string;
  label: string;
  count?: number;
}

interface FilterBarProps {
  tabs: FilterTab[];
  active: string;
  onChange: (key: string) => void;
}

export default function FilterBar({ tabs, active, onChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              isActive
                ? "bg-gold-subtle text-gold border border-gold-border"
                : "text-muted hover:text-ink hover:bg-surface-hover border border-transparent"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold ${
                  isActive
                    ? "bg-gold/20 text-gold"
                    : "bg-border text-muted"
                }`}
              >
                {tab.count > 99 ? "99+" : tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
