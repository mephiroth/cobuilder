import React from "react";

const STATUS_MAP: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  pending: { label: "待澄清", bg: "bg-amber-100", text: "text-amber-700" },
  clarified: { label: "已澄清", bg: "bg-blue-100", text: "text-blue-700" },
  in_progress: { label: "进行中", bg: "bg-amber-200", text: "text-amber-800" },
  published: { label: "已发布", bg: "bg-green-100", text: "text-green-700" },
  deferred: { label: "搁置", bg: "bg-gray-100", text: "text-gray-600" },
  closed: { label: "已关闭", bg: "bg-gray-200", text: "text-gray-600" },
};

interface StatusTagProps {
  status: string;
  size?: "sm" | "md";
}

export default function StatusTag({ status, size = "sm" }: StatusTagProps) {
  const config = STATUS_MAP[status] ?? {
    label: status,
    bg: "bg-gray-100",
    text: "text-gray-600",
  };

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses}`}
    >
      {config.label}
    </span>
  );
}
