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

  // Form state
  const [name, setName] = useState("");
  const [codebaseDir, setCodebaseDir] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/projects", {
          headers: getAuthHeaders(),
        });
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
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
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

  const isDirty =
    project &&
    (name !== project.name ||
      codebaseDir !== project.codebase_dir ||
      description !== (project.description || ""));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-muted">
        <p>未找到项目数据</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h2 className="font-serif text-lg font-bold text-ink">项目设置</h2>
        <p className="text-sm text-muted mt-1">管理当前项目的基本信息</p>
      </div>

      <form onSubmit={handleSave} className="bg-paper rounded-xl border border-border divide-y divide-border">
        {/* Project Name */}
        <div className="px-6 py-5 space-y-1.5">
          <label className="block text-sm font-medium text-ink">
            项目名称
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="项目名称"
            required
            className="w-full px-4 py-2.5 rounded-lg bg-cream border border-border text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all"
          />
        </div>

        {/* Description */}
        <div className="px-6 py-5 space-y-1.5">
          <label className="block text-sm font-medium text-ink">
            项目描述
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简短描述这个项目的用途..."
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg bg-cream border border-border text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all resize-none"
          />
        </div>

        {/* Codebase Dir */}
        <div className="px-6 py-5 space-y-1.5">
          <label className="block text-sm font-medium text-ink">
            代码库路径
          </label>
          <p className="text-xs text-muted">AI Agent 分析需求时使用的本地代码目录</p>
          <input
            type="text"
            value={codebaseDir}
            onChange={(e) => setCodebaseDir(e.target.value)}
            placeholder="/path/to/your/project"
            className="w-full px-4 py-2.5 rounded-lg bg-cream border border-border text-sm text-ink font-mono placeholder:text-muted/50 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all"
          />
        </div>

        {/* Project ID (read-only) */}
        <div className="px-6 py-5 space-y-1.5">
          <label className="block text-sm font-medium text-ink">
            项目 ID
          </label>
          <p className="text-xs text-muted">提交想法时需要传入此 ID</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={project.id}
              readOnly
              className="flex-1 px-4 py-2.5 rounded-lg bg-cream/50 border border-border text-sm text-muted font-mono cursor-default select-all"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(project.id)}
              className="px-3 py-2.5 rounded-lg border border-border text-xs text-muted hover:text-ink hover:bg-cream transition-all"
            >
              复制
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="text-xs text-muted">
            创建于{" "}
            {new Date(project.created_at + "Z").toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
          <div className="flex items-center gap-3">
            {error && <p className="text-sm text-red-500">{error}</p>}
            {saved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                已保存
              </span>
            )}
            <button
              type="submit"
              disabled={!isDirty || saving || !name.trim()}
              className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-light disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              保存更改
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
