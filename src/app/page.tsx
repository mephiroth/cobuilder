"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import IdeaCard from "@/components/IdeaCard";
import FilterBar from "@/components/FilterBar";

interface Project {
  id: string;
  name: string;
  description?: string;
}

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
  comment_count?: number;
}

const FILTER_TABS = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待澄清" },
  { key: "clarified", label: "已澄清" },
  { key: "in_progress", label: "进行中" },
  { key: "published", label: "已实现" },
  { key: "deferred", label: "已搁置" },
];

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("加载项目失败");
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载项目失败");
    }
  }, []);

  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedProject !== "all") params.set("project_id", selectedProject);
      if (activeFilter !== "all") params.set("status", activeFilter);
      const url = "/api/ideas" + (params.toString() ? "?" + params.toString() : "");
      const res = await fetch(url);
      if (!res.ok) throw new Error("加载想法失败");
      setIdeas(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载想法失败");
    } finally {
      setLoading(false);
    }
  }, [selectedProject, activeFilter]);

  const fetchCounts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedProject !== "all") params.set("project_id", selectedProject);
      const url = "/api/ideas/stats" + (params.toString() ? "?" + params.toString() : "");
      const res = await fetch(url);
      if (res.ok) setCounts(await res.json());
    } catch { /* ignore */ }
  }, [selectedProject]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => { fetchIdeas(); fetchCounts(); }, [fetchIdeas, fetchCounts]);

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  const filterTabsWithCounts = FILTER_TABS.map((tab) => ({
    ...tab,
    count: tab.key === "all" ? totalCount : (counts[tab.key] ?? 0),
  }));

  return (
    <div className="min-h-screen bg-cream">
      {/* Navbar */}
      <nav className="navbar-glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="font-serif text-lg font-bold text-gold hover:text-gold-light transition-colors">
            CoBuilder
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/submit"
              className="btn btn-ghost text-sm px-3 py-1.5 text-muted hover:text-ink"
            >
              提交需求
            </Link>
            <Link
              href="/admin"
              className="btn btn-secondary text-sm px-3 py-1.5"
            >
              管理后台
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-24 pb-10 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-subtle border border-gold-border text-xs font-medium text-gold mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
              AI 驱动的需求管理
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold text-ink leading-tight mb-3">
              需求管理池
            </h1>
            <p className="text-muted text-base sm:text-lg">
              提交你的想法，AI 自动分析并生成结构化需求文档
            </p>
          </div>
          <Link
            href="/submit"
            className="btn btn-primary px-6 py-3 text-sm font-semibold self-start sm:self-auto flex-shrink-0 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            提交需求
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        {/* Project Tabs */}
        {projects.length > 1 && (
          <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedProject("all")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                selectedProject === "all"
                  ? "bg-ink text-cream"
                  : "bg-paper text-muted hover:text-ink border border-border"
              }`}
            >
              所有项目
            </button>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  selectedProject === p.id
                    ? "bg-ink text-cream"
                    : "bg-paper text-muted hover:text-ink border border-border"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Filter Bar */}
        <div className="mb-6">
          <FilterBar
            tabs={filterTabsWithCounts}
            active={activeFilter}
            onChange={setActiveFilter}
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card p-5">
                <div className="flex gap-4">
                  <div className="skeleton w-11 h-14 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-3/4 rounded" />
                    <div className="skeleton h-3 w-full rounded" />
                    <div className="skeleton h-3 w-2/3 rounded" />
                    <div className="skeleton h-3 w-1/3 rounded mt-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-base font-medium text-ink mb-1">加载失败</p>
            <p className="text-sm text-muted mb-4">{error}</p>
            <button
              onClick={() => { setError(null); fetchIdeas(); }}
              className="btn btn-secondary text-sm px-4 py-2"
            >
              重试
            </button>
          </div>
        ) : ideas.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-base font-medium text-ink mb-1">
              {activeFilter === "all" ? "还没有需求" : "该状态下暂无需求"}
            </p>
            <p className="text-sm text-muted mb-5">
              {activeFilter === "all" ? "成为第一个提交需求的人吧" : "换个筛选条件试试"}
            </p>
            {activeFilter === "all" ? (
              <Link href="/submit" className="btn btn-primary text-sm px-5 py-2">
                提交第一个需求
              </Link>
            ) : (
              <button
                onClick={() => setActiveFilter("all")}
                className="btn btn-secondary text-sm px-4 py-2"
              >
                查看全部
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ideas.map((idea, idx) => (
              <IdeaCard
                key={idea.id}
                id={idea.id}
                title={idea.title}
                description={idea.description}
                status={idea.status}
                votes={idea.votes}
                authorName={idea.author_name}
                createdAt={idea.created_at}
                commentCount={idea.comment_count}
                animationDelay={idx * 40}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <p className="text-xs text-muted-light">
            CoBuilder · AI 驱动的需求管理平台
          </p>
          <Link href="/admin" className="text-xs text-muted hover:text-ink transition-colors">
            管理后台
          </Link>
        </div>
      </footer>
    </div>
  );
}
