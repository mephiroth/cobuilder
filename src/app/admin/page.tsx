"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Idea {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  votes: number;
  author_name: string;
  created_at: string;
  updated_at: string;
  visible: number;
}

interface Stats {
  total: number;
  pending_count: number;
  clarified_count: number;
  in_progress_count: number;
  published_count: number;
  deferred_count: number;
  closed_count: number;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "待澄清", color: "text-status-pending" },
  { value: "clarified", label: "已澄清", color: "text-status-clarified" },
  { value: "in_progress", label: "进行中", color: "text-status-in_progress" },
  { value: "published", label: "已实现", color: "text-status-published" },
  { value: "deferred", label: "已搁置", color: "text-status-deferred" },
  { value: "closed", label: "已关闭", color: "text-status-closed" },
];

const STAT_CARDS: { key: string; label: string; field: keyof Stats; color: string }[] = [
  { key: "total", label: "全部", field: "total", color: "text-ink" },
  { key: "pending", label: "待澄清", field: "pending_count", color: "text-status-pending" },
  { key: "clarified", label: "已澄清", field: "clarified_count", color: "text-status-clarified" },
  { key: "in_progress", label: "进行中", field: "in_progress_count", color: "text-status-in_progress" },
  { key: "published", label: "已实现", field: "published_count", color: "text-status-published" },
  { key: "deferred", label: "已搁置", field: "deferred_count", color: "text-status-deferred" },
  { key: "closed", label: "已关闭", field: "closed_count", color: "text-status-closed" },
];

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("cobuilder_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "Z");
  return d.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"votes" | "date">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [batchClarifying, setBatchClarifying] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [statsRes, ideasRes] = await Promise.all([
        fetch("/api/admin/stats", { headers }),
        fetch(
          `/api/admin/ideas${filterStatus !== "all" ? `?status=${filterStatus}` : ""}`,
          { headers }
        ),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (ideasRes.ok) {
        const ideasData = await ideasRes.json();
        setIdeas(ideasData);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (ideaId: string, newStatus: string) => {
    try {
      const headers = {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      };
      const res = await fetch(`/api/admin/ideas/${ideaId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setIdeas((prev) =>
          prev.map((i) => (i.id === ideaId ? { ...i, status: newStatus } : i))
        );
      }
    } catch {
      // ignore
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === ideas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ideas.map((i) => i.id)));
    }
  };

  const handleBatchClarify = async () => {
    if (selectedIds.size === 0 || batchClarifying) return;
    setBatchClarifying(true);

    try {
      const headers = {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      };
      const ids = Array.from(selectedIds);

      await Promise.all(
        ids.map((id) =>
          fetch(`/api/admin/ideas/${id}/clarify`, {
            method: "POST",
            headers,
          })
        )
      );

      setSelectedIds(new Set());
      fetchData();
    } catch {
      // ignore
    } finally {
      setBatchClarifying(false);
    }
  };

  const sortedIdeas = [...ideas].sort((a, b) => {
    if (sortBy === "votes") {
      return sortDir === "desc" ? b.votes - a.votes : a.votes - b.votes;
    }
    return sortDir === "desc"
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const toggleSort = (field: "votes" | "date") => {
    if (sortBy === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {STAT_CARDS.map((card) => (
            <button
              key={card.key}
              onClick={() =>
                setFilterStatus(card.key === "total" ? "all" : card.key)
              }
              className={`bg-paper rounded-xl border p-4 text-center transition-all hover:shadow-sm ${
                (card.key === "total" && filterStatus === "all") ||
                card.key === filterStatus
                  ? "border-gold/40 shadow-sm"
                  : "border-border"
              }`}
            >
              <div className={`text-2xl font-bold ${card.color}`}>
                {stats[card.field]}
              </div>
              <div className="text-xs text-muted mt-1">{card.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchClarify}
              disabled={batchClarifying}
              className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-light disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-all"
            >
              {batchClarifying ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              )}
              批量 AI 澄清 ({selectedIds.size})
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">排序:</span>
          <button
            onClick={() => toggleSort("date")}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              sortBy === "date"
                ? "bg-gold/10 text-gold"
                : "text-muted hover:text-ink"
            }`}
          >
            时间 {sortBy === "date" ? (sortDir === "desc" ? "↓" : "↑") : ""}
          </button>
          <button
            onClick={() => toggleSort("votes")}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              sortBy === "votes"
                ? "bg-gold/10 text-gold"
                : "text-muted hover:text-ink"
            }`}
          >
            票数 {sortBy === "votes" ? (sortDir === "desc" ? "↓" : "↑") : ""}
          </button>
        </div>
      </div>

      {/* Ideas Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : ideas.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <p>暂无想法</p>
        </div>
      ) : (
        <div className="bg-paper rounded-xl border border-border overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === ideas.length && ideas.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-border text-gold focus:ring-gold/20 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    标题
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    作者
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    状态
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    票数
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    日期
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedIdeas.map((idea) => {
                  const statusOpt = STATUS_OPTIONS.find((s) => s.value === idea.status);
                  return (
                    <tr
                      key={idea.id}
                      className={`hover:bg-cream/50 transition-colors ${
                        selectedIds.has(idea.id) ? "bg-gold/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(idea.id)}
                          onChange={() => toggleSelect(idea.id)}
                          className="w-4 h-4 rounded border-border text-gold focus:ring-gold/20 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/ideas/${idea.id}`}
                          className="text-sm font-medium text-ink hover:text-gold transition-colors line-clamp-1"
                        >
                          {idea.title}
                        </Link>
                        {!idea.visible && (
                          <span className="text-xs text-muted ml-1">(隐藏)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {idea.author_name}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={idea.status}
                          onChange={(e) =>
                            handleStatusChange(idea.id, e.target.value)
                          }
                          className={`text-xs font-medium bg-transparent border-0 p-0 focus:ring-0 cursor-pointer ${statusOpt?.color || "text-muted"}`}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-ink">
                          {idea.votes}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted whitespace-nowrap">
                        {formatDate(idea.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/ideas/${idea.id}`}
                          className="text-xs text-gold hover:text-gold-light font-medium transition-colors"
                        >
                          编辑
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-border">
            {sortedIdeas.map((idea) => {
              const statusOpt = STATUS_OPTIONS.find((s) => s.value === idea.status);
              return (
                <div
                  key={idea.id}
                  className={`p-4 space-y-2 ${
                    selectedIds.has(idea.id) ? "bg-gold/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(idea.id)}
                      onChange={() => toggleSelect(idea.id)}
                      className="w-4 h-4 rounded border-border text-gold focus:ring-gold/20 cursor-pointer mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/admin/ideas/${idea.id}`}
                        className="text-sm font-medium text-ink hover:text-gold transition-colors block"
                      >
                        {idea.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                        <span>{idea.author_name}</span>
                        <span>·</span>
                        <span>{formatDate(idea.created_at)}</span>
                        <span>·</span>
                        <span>{idea.votes} 票</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <select
                      value={idea.status}
                      onChange={(e) =>
                        handleStatusChange(idea.id, e.target.value)
                      }
                      className={`text-xs font-medium bg-transparent border-0 p-0 focus:ring-0 cursor-pointer ${statusOpt?.color || "text-muted"}`}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-border">·</span>
                    <Link
                      href={`/admin/ideas/${idea.id}`}
                      className="text-xs text-gold hover:text-gold-light font-medium"
                    >
                      编辑
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
