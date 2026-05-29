"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import StatusTag from "@/components/StatusTag";

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

interface Project {
  id: string;
  name: string;
  description?: string;
}

interface Stats {
  total: number;
  submitted_count: number;
  review_count: number;
  pipeline_count: number;
  done_count: number;
  deferred_count: number;
  rejected_count: number;
}

const STATUS_OPTIONS = [
  { value: "submitted", label: "待启动" },
  { value: "pending_prd", label: "待审 PRD" },
  { value: "dev_pending", label: "开发中" },
  { value: "pending_merge", label: "待合入" },
  { value: "done", label: "已完成" },
  { value: "rejected", label: "已驳回" },
  { value: "deferred", label: "已搁置" },
];

const STATUS_GROUPS: Record<string, string[] | null> = {
  all: null,
  submitted: ["submitted"],
  review: ["analyzing", "pending_prd", "designing", "pending_design"],
  pipeline: ["dev_pending", "testing", "pending_merge"],
  done: ["done"],
  deferred: ["deferred"],
  rejected: ["rejected"],
};

const STAT_CARDS = [
  { key: "all", label: "全部", field: "total" as keyof Stats, color: "text-ink" },
  { key: "submitted", label: "待启动", field: "submitted_count" as keyof Stats, color: "text-amber-600" },
  { key: "review", label: "评审中", field: "review_count" as keyof Stats, color: "text-blue-600" },
  { key: "pipeline", label: "流水线", field: "pipeline_count" as keyof Stats, color: "text-amber-600" },
  { key: "done", label: "已完成", field: "done_count" as keyof Stats, color: "text-green-600" },
  { key: "deferred", label: "已搁置", field: "deferred_count" as keyof Stats, color: "text-gray-500" },
  { key: "rejected", label: "已驳回", field: "rejected_count" as keyof Stats, color: "text-gray-500" },
];

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("cobuilder_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "Z");
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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

  // New idea modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [statsRes, ideasRes, projectsRes] = await Promise.all([
        fetch("/api/admin/stats", { headers }),
        fetch("/api/admin/ideas", { headers }),
        fetch("/api/projects", { headers }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (ideasRes.ok) setIdeas(await ideasRes.json());
      if (projectsRes.ok) {
        const projectsData: Project[] = await projectsRes.json();
        setProjects(projectsData);
        if (projectsData.length > 0) setNewProjectId((prev) => prev || projectsData[0].id);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (ideaId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, status: newStatus } : i));
    } catch { /* ignore */ }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === ideas.length ? new Set() : new Set(ideas.map((i) => i.id)));
  };

  const handleBatchStart = async () => {
    if (selectedIds.size === 0 || batchClarifying) return;
    setBatchClarifying(true);
    const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
    try {
      for (const id of selectedIds) {
        const idea = ideas.find((i) => i.id === id);
        if (!idea || !["submitted", "rejected", "deferred"].includes(idea.status)) continue;
        await fetch(`/api/ideas/${id}/pipeline`, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "start" }),
        });
      }
      await fetchData();
      setSelectedIds(new Set());
    } finally {
      setBatchClarifying(false);
    }
  };

  const filteredIdeas =
    filterStatus === "all" || !STATUS_GROUPS[filterStatus]
      ? ideas
      : ideas.filter((i) => STATUS_GROUPS[filterStatus]!.includes(i.status));

  const sortedIdeas = [...filteredIdeas].sort((a, b) => {
    if (sortBy === "votes") return sortDir === "desc" ? b.votes - a.votes : a.votes - b.votes;
    return sortDir === "desc"
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const toggleSort = (field: "votes" | "date") => {
    if (sortBy === field) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortBy(field); setSortDir("desc"); }
  };

  const handleCreateIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim() || !newProjectId || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/ideas", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          author_name: newAuthor.trim() || "管理员",
          project_id: newProjectId,
        }),
      });
      if (res.ok) {
        setShowNewModal(false);
        setNewTitle(""); setNewDescription(""); setNewAuthor("");
        fetchData();
      } else {
        const data = await res.json();
        setCreateError(data.error || "创建失败，请重试");
      }
    } catch {
      setCreateError("网络错误，请重试");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {STAT_CARDS.map((card) => (
              <button
                key={card.key}
                onClick={() => setFilterStatus(card.key === "total" ? "all" : card.key)}
                className={`stat-card ${
                  (card.key === "total" && filterStatus === "all") || card.key === filterStatus
                    ? "active"
                    : ""
                }`}
              >
                <div className={`text-2xl font-bold font-serif ${card.color}`}>
                  {stats[card.field]}
                </div>
                <div className="text-xs text-muted mt-1">{card.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <button
                onClick={handleBatchStart}
                disabled={batchClarifying}
                className="btn btn-primary text-sm px-3 py-1.5"
              >
                {batchClarifying ? (
                  <div className="spinner spinner-sm spinner-white" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                )}
                批量启动 ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => { setShowNewModal(true); setCreateError(null); }}
              className="btn btn-secondary text-sm px-3 py-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新建需求
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-muted mr-1">排序</span>
            <button
              onClick={() => toggleSort("date")}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                sortBy === "date" ? "bg-gold-subtle text-gold" : "text-muted hover:text-ink hover:bg-surface-hover"
              }`}
            >
              时间 {sortBy === "date" ? (sortDir === "desc" ? "↓" : "↑") : ""}
            </button>
            <button
              onClick={() => toggleSort("votes")}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                sortBy === "votes" ? "bg-gold-subtle text-gold" : "text-muted hover:text-ink hover:bg-surface-hover"
              }`}
            >
              票数 {sortBy === "votes" ? (sortDir === "desc" ? "↓" : "↑") : ""}
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="card overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
                <div className="skeleton w-4 h-4 rounded" />
                <div className="skeleton h-4 flex-1 rounded" />
                <div className="skeleton h-4 w-16 rounded" />
                <div className="skeleton h-5 w-14 rounded-full" />
                <div className="skeleton h-4 w-8 rounded" />
                <div className="skeleton h-4 w-24 rounded" />
              </div>
            ))}
          </div>
        ) : ideas.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-base font-medium text-ink mb-1">暂无需求</p>
            <p className="text-sm text-muted mb-4">
              {filterStatus !== "all" ? "该状态下暂无需求" : "还没有人提交需求"}
            </p>
            <button
              onClick={() => { setShowNewModal(true); setCreateError(null); }}
              className="btn btn-primary text-sm px-4 py-2"
            >
              新建需求
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === ideas.length && ideas.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-border text-gold focus:ring-gold/20 cursor-pointer"
                      />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">标题</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">作者</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">状态</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">票数</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">时间</th>
                    <th className="w-16 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedIdeas.map((idea) => (
                    <tr
                      key={idea.id}
                      className={`hover:bg-surface transition-colors ${selectedIds.has(idea.id) ? "bg-gold-subtle/50" : ""}`}
                    >
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(idea.id)}
                          onChange={() => toggleSelect(idea.id)}
                          className="w-4 h-4 rounded border-border text-gold focus:ring-gold/20 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/ideas/${idea.id}`}
                            className="text-sm font-medium text-ink hover:text-gold transition-colors line-clamp-1 max-w-xs"
                          >
                            {idea.title}
                          </Link>
                          {!idea.visible && (
                            <span className="chip text-[10px] px-1.5 py-0.5 flex-shrink-0">隐藏</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted whitespace-nowrap">{idea.author_name}</td>
                      <td className="px-4 py-3.5">
                        <select
                          value={idea.status}
                          onChange={(e) => handleStatusChange(idea.id, e.target.value)}
                          className="text-xs font-medium bg-transparent border-0 p-0 focus:ring-0 cursor-pointer text-ink"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm font-semibold text-ink">{idea.votes}</span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted whitespace-nowrap">{formatDate(idea.created_at)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/admin/ideas/${idea.id}`}
                          className="text-xs font-medium text-gold hover:text-gold-light transition-colors"
                        >
                          编辑 →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {sortedIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className={`p-4 ${selectedIds.has(idea.id) ? "bg-gold-subtle/50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(idea.id)}
                      onChange={() => toggleSelect(idea.id)}
                      className="w-4 h-4 rounded border-border text-gold focus:ring-gold/20 cursor-pointer mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <Link
                          href={`/admin/ideas/${idea.id}`}
                          className="text-sm font-medium text-ink hover:text-gold transition-colors"
                        >
                          {idea.title}
                        </Link>
                        <StatusTag status={idea.status} size="sm" />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span>{idea.author_name}</span>
                        <span>·</span>
                        <span>{formatDate(idea.created_at)}</span>
                        <span>·</span>
                        <span>{idea.votes} 票</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New Idea Modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowNewModal(false)}>
          <div className="modal-content max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-serif text-base font-bold text-ink">新建需求</h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="btn btn-ghost p-1.5 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateIdea} className="p-6 space-y-4">
              {projects.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    所属项目 <span className="text-error">*</span>
                  </label>
                  {projects.length === 0 ? (
                    <p className="text-sm text-muted">暂无项目，请先在项目设置中创建</p>
                  ) : (
                    <select
                      value={newProjectId}
                      onChange={(e) => setNewProjectId(e.target.value)}
                      required
                      className="input-base"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.description ? ` — ${p.description}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  标题 <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="简短描述这个需求"
                  autoFocus
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  详细描述 <span className="text-error">*</span>
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="详细说明需求的背景、目标和预期效果..."
                  rows={5}
                  className="input-base resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">提交人</label>
                <input
                  type="text"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  placeholder="留空则显示为「管理员」"
                  className="input-base"
                />
              </div>
              {createError && (
                <p className="text-sm text-error">{createError}</p>
              )}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="btn btn-ghost text-sm px-4 py-2"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || !newDescription.trim() || !newProjectId || creating}
                  className="btn btn-primary text-sm px-5 py-2"
                >
                  {creating ? <div className="spinner spinner-sm spinner-white" /> : null}
                  创建需求
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
