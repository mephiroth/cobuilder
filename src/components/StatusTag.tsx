interface StatusTagProps {
  status: string;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  submitted: { label: "已提交", className: "badge-pending", dot: "bg-amber-500" },
  analyzing: { label: "分析中", className: "badge-in_progress", dot: "bg-blue-500" },
  pending_prd: { label: "待审 PRD", className: "badge-clarified", dot: "bg-blue-500" },
  designing: { label: "设计中", className: "badge-in_progress", dot: "bg-blue-500" },
  pending_design: { label: "待审设计", className: "badge-clarified", dot: "bg-blue-500" },
  dev_pending: { label: "开发中", className: "badge-in_progress", dot: "bg-amber-500" },
  testing: { label: "测试中", className: "badge-in_progress", dot: "bg-amber-500" },
  pending_merge: { label: "待合入", className: "badge-clarified", dot: "bg-purple-500" },
  done: { label: "已完成", className: "badge-published", dot: "bg-green-500" },
  rejected: { label: "已驳回", className: "badge-closed", dot: "bg-red-500" },
  deferred: { label: "已搁置", className: "badge-deferred", dot: "bg-gray-400" },
  pending: { label: "待澄清", className: "badge-pending", dot: "bg-amber-500" },
  clarified: { label: "已澄清", className: "badge-clarified", dot: "bg-blue-500" },
  in_progress: { label: "进行中", className: "badge-in_progress", dot: "bg-amber-500" },
  published: { label: "已实现", className: "badge-published", dot: "bg-green-500" },
  closed: { label: "已关闭", className: "badge-closed", dot: "bg-gray-500" },
};

export default function StatusTag({ status, size = "md" }: StatusTagProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "badge-deferred",
    dot: "bg-gray-400",
  };

  return (
    <span className={`badge ${config.className} ${size === "sm" ? "text-[10px] px-1.5 py-0.5" : ""}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} flex-shrink-0`} />
      {config.label}
    </span>
  );
}
