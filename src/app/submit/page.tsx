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

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) throw new Error("加载项目失败");
        const data = await res.json();
        setProjects(data);
        if (data.length === 1) {
          setSelectedProject(data[0].id);
        }
      } catch {
        setError("加载项目列表失败");
      } finally {
        setLoadingProjects(false);
      }
    }
    loadProjects();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !title.trim() || !description.trim() || submitting)
      return;

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

  const charCount = description.length;

  return (
    <div className="min-h-screen bg-cream">
      {/* Navbar */}
      <nav className="navbar-glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-serif text-lg font-bold text-gold hover:text-gold-light transition-colors">
            CoBuilder
          </Link>
          <Link
            href="/"
            className="text-sm text-muted hover:text-ink transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </Link>
        </div>
      </nav>

      <main className="pt-24 max-w-2xl mx-auto px-4 sm:px-6 pb-20">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-ink mb-2">许一个愿望</h1>
          <p className="text-muted text-sm">
            把你的想法写下来，让它有机会变成现实
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-paper rounded-xl border border-border p-6 sm:p-8 animate-fade-in"
        >
          <div className="space-y-5">
            {/* Project Selector */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                项目 <span className="text-status-pending">*</span>
              </label>
              {loadingProjects ? (
                <div className="h-10 rounded-lg bg-cream border border-border animate-pulse-soft" />
              ) : (
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-lg bg-cream border border-border text-sm text-ink focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 0.75rem center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "1.25em 1.25em",
                  }}
                >
                  <option value="">请选择项目...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                标题 <span className="text-status-pending">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="用一句话描述你的想法..."
                required
                maxLength={100}
                className="w-full px-4 py-2.5 rounded-lg bg-cream border border-border text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all"
              />
              <p className="mt-1 text-xs text-muted/60 text-right">
                {title.length}/100
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                详细描述 <span className="text-status-pending">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="详细描述你的想法、需求或问题...&#10;&#10;支持 Markdown 格式：&#10;- **加粗** &#10;- *斜体*&#10;- `代码`&#10;- 列表"
                required
                rows={8}
                className="w-full px-4 py-3 rounded-lg bg-cream border border-border text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all resize-none font-mono leading-relaxed"
              />
              <p className="mt-1 text-xs text-muted/60 text-right">
                {charCount} 字 · 支持 Markdown
              </p>
            </div>

            {/* Nickname */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                昵称 <span className="text-xs text-muted/60 font-normal">（可选）</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="留空则显示为匿名"
                maxLength={30}
                className="w-full px-4 py-2.5 rounded-lg bg-cream border border-border text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all"
              />
            </div>

            {/* Contact */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                联系方式 <span className="text-xs text-muted/60 font-normal">（可选，方便沟通细节）</span>
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="邮箱、微信等"
                maxLength={100}
                className="w-full px-4 py-2.5 rounded-lg bg-cream border border-border text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="mt-8 flex items-center justify-between">
            <Link
              href="/"
              className="text-sm text-muted hover:text-ink transition-colors"
            >
              取消
            </Link>
            <button
              type="submit"
              disabled={!selectedProject || !title.trim() || !description.trim() || submitting}
              className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-8 py-2.5 rounded-lg text-sm transition-all active:scale-[0.97]"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  需求管理
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
