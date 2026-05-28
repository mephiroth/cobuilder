"use client";

import { useState, useEffect } from "react";

interface Project {
  id: string;
  name: string;
  codebase_dir: string;
  description?: string;
  created_at: string;
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("cobuilder_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function SettingsPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [codebaseDir, setCodebaseDir] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/projects", { headers: getAuthHeaders() });
        if (res.ok) {
          const projects: Project[] = await res.json();
          if (projects.length > 0) {
            const p = projects[0];
            setProject(p);
            setName(p.name);
            setCodebaseDir(p.codebase_dir);
            setDescription(p.description || "");
          }
        }
      } catch {
        setError("加载失败，请刷新重试");
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          codebase_dir: codebaseDir.trim(),
          description: description.trim(),
        }),
      });

      if (res.ok) {
        const updated: Project = await res.json();
        setProject(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "保存失败，请重试");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!project) return;
    await navigator.clipboard.writeText(project.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDirty = project && (
    name !== project.name ||
    codebaseDir !== project.codebase_dir ||
    description !== (project.description || "")
  );

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4 animate-fade-in">
        <div className="skeleton h-7 w-40 rounded-lg" />
        <div className="card overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-6 py-5 border-b border-border last:border-0">
              <div className="skeleton h-4 w-24 rounded mb-3" />
              <div className="skeleton h-10 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="empty-state">
        <p className="text-base font-medium text-ink mb-1">未找到项目数据</p>
        <p className="text-sm text-muted">请检查数据库配置</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h2 className="font-serif text-xl font-bold text-ink">项目设置</h2>
        <p className="text-sm text-muted mt-1">管理当前项目的基本信息和 AI 配置</p>
      </div>

      <form onSubmit={handleSave} className="card overflow-hidden divide-y divide-border">
        {/* Project Name */}
        <div className="px-6 py-5">
          <label className="block text-sm font-semibold text-ink mb-1">项目名称</label>
          <p className="text-xs text-muted mb-3">显示在前台页面和管理后台的项目标识</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="项目名称"
            required
            className="input-base"
          />
        </div>

        {/* Description */}
        <div className="px-6 py-5">
          <label className="block text-sm font-semibold text-ink mb-1">项目描述</label>
          <p className="text-xs text-muted mb-3">简短描述项目用途，帮助用户了解该提交什么需求</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简短描述这个项目的用途..."
            rows={3}
            className="input-base resize-none"
          />
        </div>

        {/* Codebase Dir */}
        <div className="px-6 py-5">
          <label className="block text-sm font-semibold text-ink mb-1">代码库路径</label>
          <p className="text-xs text-muted mb-3">AI Agent 分析需求时读取的本地代码目录，用于生成更准确的需求文档</p>
          <input
            type="text"
            value={codebaseDir}
            onChange={(e) => setCodebaseDir(e.target.value)}
            placeholder="/path/to/your/project"
            className="input-base font-mono"
          />
        </div>

        {/* Project ID */}
        <div className="px-6 py-5">
          <label className="block text-sm font-semibold text-ink mb-1">项目 ID</label>
          <p className="text-xs text-muted mb-3">通过 API 提交需求时需要传入此 ID</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={project.id}
              readOnly
              className="input-base font-mono text-muted cursor-default select-all flex-1"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`btn text-xs px-3 py-2.5 flex-shrink-0 transition-all ${
                copied
                  ? "btn-secondary text-green-600 border-green-200"
                  : "btn-secondary"
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  已复制
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  复制
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-surface flex items-center justify-between gap-4">
          <p className="text-xs text-muted">
            创建于 {new Date(project.created_at + "Z").toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
          </p>
          <div className="flex items-center gap-3">
            {error && (
              <p className="text-sm text-error">{error}</p>
            )}
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                已保存
              </span>
            )}
            <button
              type="submit"
              disabled={!isDirty || saving || !name.trim()}
              className="btn btn-primary text-sm px-5 py-2"
            >
              {saving ? <div className="spinner spinner-sm spinner-white" /> : null}
              保存更改
            </button>
          </div>
        </div>
      </form>

      {/* API Usage Card */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink mb-3">API 使用示例</h3>
        <p className="text-xs text-muted mb-3">通过 API 提交需求：</p>
        <pre className="bg-ink text-green-400 text-xs p-4 rounded-xl overflow-x-auto font-mono leading-relaxed">
{`curl -X POST /api/ideas/create \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "${project.id}",
    "title": "需求标题",
    "description": "详细描述",
    "author_name": "提交人"
  }'`}
        </pre>
      </div>
    </div>
  );
}
