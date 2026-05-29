"use client";

import { useState, useEffect, useCallback } from "react";

interface Project {
  id: string;
  name: string;
  codebase_dir: string;
  description?: string;
  archived: number;
  created_at: string;
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("cobuilder_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "Z").toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── 新建/编辑项目弹窗 ───────────────────────────────────────────────────────

interface ProjectModalProps {
  project?: Project | null;
  onClose: () => void;
  onSaved: () => void;
}

function ProjectModal({ project, onClose, onSaved }: ProjectModalProps) {
  const isEdit = !!project;
  const [name, setName] = useState(project?.name ?? "");
  const [codebaseDir, setCodebaseDir] = useState(project?.codebase_dir ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const body = { name: name.trim(), codebase_dir: codebaseDir.trim(), description: description.trim() };
      const res = isEdit
        ? await fetch(`/api/admin/projects/${project!.id}`, {
            method: "PATCH",
            headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/admin/projects", {
            method: "POST",
            headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "操作失败，请重试");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-serif text-base font-bold text-ink">
            {isEdit ? "编辑项目" : "新建项目"}
          </h2>
          <button onClick={onClose} className="btn btn-ghost p-1.5 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              项目名称 <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：CoBuilder 主站"
              required
              maxLength={50}
              autoFocus
              className="input-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              代码库路径 <span className="text-error">*</span>
            </label>
            <p className="text-xs text-muted mb-2">AI Agent 分析需求时读取的本地代码目录</p>
            <input
              type="text"
              value={codebaseDir}
              onChange={(e) => setCodebaseDir(e.target.value)}
              placeholder="/path/to/your/project"
              required
              className="input-base font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">项目描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简短描述项目用途，帮助用户了解该提交什么需求..."
              rows={3}
              className="input-base resize-none"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost text-sm px-4 py-2">
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !codebaseDir.trim() || saving}
              className="btn btn-primary text-sm px-5 py-2"
            >
              {saving ? <div className="spinner spinner-sm spinner-white" /> : null}
              {isEdit ? "保存更改" : "创建项目"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 归档确认弹窗 ─────────────────────────────────────────────────────────────

interface ArchiveConfirmProps {
  project: Project;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function ArchiveConfirm({ project, onClose, onConfirm, loading }: ArchiveConfirmProps) {
  const isArchived = project.archived === 1;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-sm">
        <div className="p-6">
          <h2 className="font-serif text-base font-bold text-ink mb-2">
            {isArchived ? "恢复项目" : "归档项目"}
          </h2>
          <p className="text-sm text-muted mb-6">
            {isArchived
              ? `确定要恢复「${project.name}」吗？恢复后该项目将重新接收新需求。`
              : `确定要归档「${project.name}」吗？归档后该项目将不再接收新需求，但已有需求不受影响。`}
          </p>
          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose} className="btn btn-ghost text-sm px-4 py-2">
              取消
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`btn text-sm px-5 py-2 ${isArchived ? "btn-primary" : "bg-amber-500 hover:bg-amber-600 text-white border-transparent"}`}
            >
              {loading ? <div className="spinner spinner-sm spinner-white" /> : null}
              {isArchived ? "确认恢复" : "确认归档"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);
  const [archiving, setArchiving] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/projects", { headers: getAuthHeaders() });
      if (res.ok) {
        setProjects(await res.json());
      } else {
        // fallback: use public endpoint
        const res2 = await fetch("/api/projects", { headers: getAuthHeaders() });
        if (res2.ok) setProjects(await res2.json());
      }
    } catch {
      setError("加载失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleCopyId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleArchiveToggle = async () => {
    if (!archiveTarget || archiving) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/admin/projects/${archiveTarget.id}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ archived: archiveTarget.archived === 1 ? 0 : 1 }),
      });
      if (res.ok) {
        await fetchProjects();
        setArchiveTarget(null);
      }
    } finally {
      setArchiving(false);
    }
  };

  const activeProjects = projects.filter((p) => p.archived === 0);
  const archivedProjects = projects.filter((p) => p.archived === 1);

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4 animate-fade-in">
        <div className="skeleton h-7 w-40 rounded-lg" />
        <div className="card overflow-hidden">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="px-6 py-5 border-b border-border last:border-0">
              <div className="skeleton h-5 w-48 rounded mb-2" />
              <div className="skeleton h-4 w-64 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-bold text-ink">项目管理</h2>
          <p className="text-sm text-muted mt-1">管理所有项目，需求创建时必须绑定项目</p>
        </div>
        <button
          onClick={() => { setEditingProject(null); setShowModal(true); }}
          className="btn btn-primary text-sm px-4 py-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建项目
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-error">
          {error}
        </div>
      )}

      {/* Active Projects */}
      <div>
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          活跃项目 ({activeProjects.length})
        </h3>
        {activeProjects.length === 0 ? (
          <div className="card p-8 text-center">
            <svg className="w-10 h-10 text-muted-light mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-sm font-medium text-ink mb-1">暂无活跃项目</p>
            <p className="text-xs text-muted mb-4">创建第一个项目，开始收集需求</p>
            <button
              onClick={() => { setEditingProject(null); setShowModal(true); }}
              className="btn btn-primary text-sm px-4 py-2"
            >
              新建项目
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden divide-y divide-border">
            {activeProjects.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                copiedId={copiedId}
                onCopy={handleCopyId}
                onEdit={() => { setEditingProject(p); setShowModal(true); }}
                onArchive={() => setArchiveTarget(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Archived Projects */}
      {archivedProjects.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            已归档 ({archivedProjects.length})
          </h3>
          <div className="card overflow-hidden divide-y divide-border opacity-70">
            {archivedProjects.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                copiedId={copiedId}
                onCopy={handleCopyId}
                onEdit={() => { setEditingProject(p); setShowModal(true); }}
                onArchive={() => setArchiveTarget(p)}
              />
            ))}
          </div>
        </div>
      )}

    </div>

      {/* Modals — 渲染在 animate-fade-in 外，避免 transform 导致 fixed 定位偏移 */}
      {showModal && (
        <ProjectModal
          key={editingProject?.id ?? "new"}
          project={editingProject}
          onClose={() => setShowModal(false)}
          onSaved={fetchProjects}
        />
      )}
      {archiveTarget && (
        <ArchiveConfirm
          project={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onConfirm={handleArchiveToggle}
          loading={archiving}
        />
      )}
    </>
  );
}

// ─── 项目行组件 ───────────────────────────────────────────────────────────────

interface ProjectRowProps {
  project: Project;
  copiedId: string | null;
  onCopy: (id: string) => void;
  onEdit: () => void;
  onArchive: () => void;
}

function ProjectRow({ project, copiedId, onCopy, onEdit, onArchive }: ProjectRowProps) {
  const isArchived = project.archived === 1;
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-ink">{project.name}</span>
            {isArchived && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface text-muted border border-border">
                已归档
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-xs text-muted mb-1.5 line-clamp-1">{project.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-light">
            <span className="font-mono truncate max-w-[200px]" title={project.codebase_dir}>
              {project.codebase_dir}
            </span>
            <span>·</span>
            <span>创建于 {formatDate(project.created_at)}</span>
          </div>
          {/* Project ID row */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] text-muted-light font-mono truncate max-w-[220px]">{project.id}</span>
            <button
              onClick={() => onCopy(project.id)}
              className="text-[10px] text-muted hover:text-ink transition-colors flex items-center gap-0.5"
              title="复制项目 ID"
            >
              {copiedId === project.id ? (
                <>
                  <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-600">已复制</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  复制 ID
                </>
              )}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onEdit}
            className="btn btn-ghost text-xs px-2.5 py-1.5"
          >
            编辑
          </button>
          <button
            onClick={onArchive}
            className={`btn btn-ghost text-xs px-2.5 py-1.5 ${isArchived ? "hover:text-green-600" : "hover:text-amber-600"}`}
          >
            {isArchived ? "恢复" : "归档"}
          </button>
        </div>
      </div>
    </div>
  );
}
