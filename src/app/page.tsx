"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "待澄清", color: "bg-status-pending/10 text-status-pending border-status-pending/20" },
  clarified: { label: "已澄清", color: "bg-status-clarified/10 text-status-clarified border-status-clarified/20" },
  in_progress: { label: "进行中", color: "bg-status-in_progress/10 text-status-in_progress border-status-in_progress/20" },
  published: { label: "已实现", color: "bg-status-published/10 text-status-published border-status-published/20" },
  deferred: { label: "已搁置", color: "bg-status-deferred/10 text-status-deferred border-status-deferred/20" },
  closed: { label: "已关闭", color: "bg-status-closed/10 text-status-closed border-status-closed/20" },
};

const FILTER_TABS = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待澄清" },
  { key: "clarified", label: "已澄清" },
  { key: "in_progress", label: "进行中" },
  { key: "published", label: "已实现" },
  { key: "deferred", label: "搁置" },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "Z");
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 30) return `${diffDay} 天前`;
  return d.toLocaleDateString("zh-CN");
}

function truncate(text: string, maxLen: number) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

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
      let url = "/api/ideas";
      const params = new URLSearchParams();
      if (selectedProject !== "all") params.set("project_id", selectedProject);
      if (activeFilter !== "all") params.set("status", activeFilter);
      if (params.toString()) url += "?" + params.toString();

      const res = await fetch(url);
      if (!res.ok) throw new Error("加载想法失败");
      const data = await res.json();
      setIdeas(data);
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
      let url = "/api/ideas/stats";
      if (params.toString()) url += "?" + params.toString();
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCounts(data);
      }
    } catch {
      // ignore
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchIdeas();
    fetchCounts();
  }, [fetchIdeas, fetchCounts]);

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-cream">
      {/* Navbar */}
      <nav className="navbar-glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-serif text-lg font-bold text-gold hover:text-gold-light transition-colors">
            CoBuilder
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/submit"
              className="text-sm text-muted hover:text-ink transition-colors"
            >
              需求管理
            </Link>
            <Link
              href="/admin"
              className="text-sm text-muted hover:text-ink transition-colors"
            >
              管理
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-24 pb-12 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-ink mb-4">
          需求管理池
        </h1>
        <p className="text-muted text-lg mb-8">
          你的每一个想法，都值得被认真对待
        </p>
        <Link
          href="/submit"
          className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-white font-medium px-8 py-3 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          许一个愿望
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        {/* Project Tabs */}
        {projects.length > 1 && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedProject("all")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
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
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
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
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === "all"
                ? totalCount
                : counts[tab.key] || 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                  activeFilter === tab.key
                    ? "bg-gold/10 text-gold border border-gold/20"
                    : "text-muted hover:text-ink hover:bg-paper"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs ${
                      activeFilter === tab.key
                        ? "bg-gold/20 text-gold"
                        : "bg-border text-muted"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Ideas Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted text-sm">加载中...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchIdeas();
              }}
              className="text-sm text-gold hover:text-gold-light underline"
            >
              重试
            </button>
          </div>
        ) : ideas.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 text-border">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-muted text-lg mb-2">还没有人需求管理</p>
            <p className="text-muted/70 text-sm mb-6">做第一个吧！</p>
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-white font-medium px-6 py-2.5 rounded-lg transition-all text-sm"
            >
              许一个愿望
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ideas.map((idea, idx) => {
              const statusInfo = STATUS_MAP[idea.status] || {
                label: idea.status,
                color: "bg-gray-100 text-gray-600 border-gray-200",
              };
              return (
                <Link
                  key={idea.id}
                  href={`/ideas/${idea.id}`}
                  className="group bg-paper rounded-xl border border-border hover:border-gold/30 hover:shadow-sm transition-all duration-200 p-5 animate-fade-in"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex gap-4">
                    {/* Vote Section */}
                    <div className="flex flex-col items-center pt-0.5 shrink-0">
                      <div className="w-10 h-10 flex flex-col items-center justify-center rounded-lg bg-cream group-hover:bg-gold/5 transition-colors">
                        <svg
                          className="w-4 h-4 text-muted group-hover:text-gold transition-colors"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                        <span className="text-xs font-semibold text-ink mt-0.5">
                          {idea.votes}
                        </span>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <h3 className="font-serif text-base font-bold text-ink group-hover:text-gold transition-colors line-clamp-1">
                          {idea.title}
                        </h3>
                        <span
                          className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted leading-relaxed line-clamp-2 mb-3">
                        {truncate(idea.description.replace(/[#*`>\-]/g, "").trim(), 120)}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted/70">
                        <span>{idea.author_name}</span>
                        <span>·</span>
                        <span>{formatDate(idea.created_at)}</span>
                        {idea.comment_count !== undefined && idea.comment_count > 0 && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              {idea.comment_count}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center">
        <p className="text-xs text-muted/60">
          CoBuilder · 让每个想法都有机会实现
        </p>
      </footer>
    </div>
  );
}
