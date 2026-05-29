"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description?: string;
}

export default function SubmitPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [nickname, setNickname] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsLoadError, setProjectsLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) throw new Error("加载项目失败");
        const data = await res.json();
        setProjects(data);
        // 只有一个项目时自动预选，多个项目时不预选
        if (data.length === 1) setSelectedProject(data[0].id);
      } catch {
        setProjectsLoadError(true);
      } finally {
        setLoadingProjects(false);
      }
    }
    loadProjects();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !title.trim() || !description.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/ideas/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: selectedProject,
          title: title.trim(),
          description: description.trim(),
          author_name: nickname.trim() || "匿名",
          author_contact: contact.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "提交失败");
      }

      const newIdea = await res.json();
      router.push(`/ideas/${newIdea.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = selectedProject && title.trim() && description.trim() && !projectsLoadError && projects.length > 0;

  return (
    <div className="min-h-screen bg-cream">
      {/* Navbar */}
      <nav className="navbar-glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回
            </Link>
            <span className="text-border">|</span>
            <Link href="/" className="font-serif text-base font-bold text-gold hover:text-gold-light transition-colors">
              CoBuilder
            </Link>
          </div>
          <span className="text-sm text-muted">提交需求</span>
        </div>
      </nav>

      <main className="pt-20 max-w-2xl mx-auto px-4 sm:px-6 pb-20">
        {/* Page Header */}
        <div className="py-8">
          <h1 className="font-serif text-3xl font-bold text-ink mb-2">提交需求</h1>
          <p className="text-muted text-sm">
            描述你的想法，AI 会自动分析并生成结构化需求文档
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Project Selector — 始终展示 */}
          <div className="card p-5">
            <label className="block text-sm font-semibold text-ink mb-3">
              所属项目
              <span className="text-error ml-1">*</span>
            </label>
            {loadingProjects ? (
              <div className="skeleton h-10 rounded-lg" />
            ) : projectsLoadError ? (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                <svg className="w-4 h-4 text-error flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-error">加载项目列表失败，请刷新重试</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-sm text-amber-700">暂无可用项目，请联系管理员</p>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  required
                  className="input-base appearance-none pr-10"
                >
                  {projects.length > 1 && <option value="">请选择项目...</option>}
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.description ? ` — ${p.description}` : ""}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="card p-5">
            <label className="block text-sm font-semibold text-ink mb-3">
              需求标题
              <span className="text-error ml-1">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="用一句话描述你的需求..."
              required
              maxLength={100}
              className="input-base"
            />
            <div className="flex justify-end mt-1.5">
              <span className="text-xs text-muted-light">{title.length}/100</span>
            </div>
          </div>

          {/* Description */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-ink">
                详细描述
                <span className="text-error ml-1">*</span>
              </label>
              <div className="flex items-center gap-1 bg-surface-hover rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("write")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "write"
                      ? "bg-paper text-ink shadow-xs"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  编写
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === "preview"
                      ? "bg-paper text-ink shadow-xs"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  预览
                </button>
              </div>
            </div>

            {activeTab === "write" ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`详细描述你的需求、背景和预期效果...\n\n支持 Markdown 格式：\n- **加粗文字**\n- *斜体文字*\n- \`代码片段\`\n- ## 标题`}
                required
                rows={10}
                className="input-base font-mono leading-relaxed resize-none"
              />
            ) : (
              <div className="min-h-[200px] p-4 rounded-lg bg-surface border border-border">
                {description ? (
                  <div className="prose max-w-none text-sm">
                    {/* Simple preview - just show the text */}
                    <pre className="whitespace-pre-wrap font-sans text-sm text-ink leading-relaxed">{description}</pre>
                  </div>
                ) : (
                  <p className="text-muted-light text-sm italic">暂无内容</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-muted-light">支持 Markdown 格式</span>
              <span className="text-xs text-muted-light">{description.length} 字</span>
            </div>
          </div>

          {/* Author Info */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">提交人信息（可选）</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">昵称</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="留空则显示为匿名"
                  maxLength={30}
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">联系方式</label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="邮箱、微信等"
                  maxLength={100}
                  className="input-base"
                />
              </div>
            </div>
            <p className="text-xs text-muted-light mt-2">联系方式仅管理员可见，用于需求沟通</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
              <svg className="w-4 h-4 text-error flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            <Link href="/" className="btn btn-ghost text-sm px-4 py-2.5 text-muted">
              取消
            </Link>
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="btn btn-primary text-sm px-8 py-2.5 font-semibold"
            >
              {submitting ? (
                <>
                  <div className="spinner spinner-sm spinner-white" />
                  提交中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  提交需求
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
