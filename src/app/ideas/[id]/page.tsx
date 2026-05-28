"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import StatusTag from "@/components/StatusTag";
import CommentSection from "@/components/CommentSection";

interface Idea {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  votes: number;
  author_name: string;
  author_contact?: string;
  clarification_doc?: string;
  version?: string;
  screenshots: string;
  source: string;
  visible: number;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  idea_id: string;
  author_name: string;
  content: string;
  is_admin: number;
  created_at: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "Z");
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IdeaDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const ideaId = params.id;

  const [idea, setIdea] = useState<Idea | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ideaRes, commentsRes] = await Promise.all([
        fetch(`/api/ideas/${ideaId}`),
        fetch(`/api/ideas/${ideaId}/comments`),
      ]);

      if (!ideaRes.ok) {
        throw new Error(ideaRes.status === 404 ? "需求不存在或已被删除" : "加载失败");
      }

      setIdea(await ideaRes.json());
      if (commentsRes.ok) setComments(await commentsRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleVote = async () => {
    if (voteLoading || hasVoted) return;
    setVoteLoading(true);
    try {
      let clientId = localStorage.getItem("cobuilder_client_id");
      if (!clientId) {
        clientId = crypto.randomUUID();
        localStorage.setItem("cobuilder_client_id", clientId);
      }

      const res = await fetch(`/api/ideas/${ideaId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voter_id: clientId }),
      });

      if (res.ok) {
        const data = await res.json();
        setIdea((prev) => prev ? { ...prev, votes: data.votes } : prev);
        setHasVoted(true);
      } else {
        const data = await res.json();
        if (data.error?.includes("already")) setHasVoted(true);
      }
    } catch { /* ignore */ }
    finally { setVoteLoading(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <nav className="navbar-glass fixed top-0 left-0 right-0 z-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center">
            <Link href="/" className="font-serif text-lg font-bold text-gold">CoBuilder</Link>
          </div>
        </nav>
        <div className="pt-24 max-w-3xl mx-auto px-4 sm:px-6 space-y-4">
          <div className="skeleton h-8 w-2/3 rounded-lg" />
          <div className="card p-6 space-y-3">
            <div className="skeleton h-5 w-full rounded" />
            <div className="skeleton h-5 w-4/5 rounded" />
            <div className="skeleton h-5 w-3/5 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !idea) {
    return (
      <div className="min-h-screen bg-cream">
        <nav className="navbar-glass fixed top-0 left-0 right-0 z-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center">
            <Link href="/" className="font-serif text-lg font-bold text-gold">CoBuilder</Link>
          </div>
        </nav>
        <div className="pt-24 max-w-3xl mx-auto px-4 sm:px-6 text-center py-20">
          <p className="text-muted text-lg mb-4">{error || "需求不存在"}</p>
          <Link href="/" className="btn btn-secondary text-sm px-4 py-2">返回首页</Link>
        </div>
      </div>
    );
  }

  const screenshots: string[] = (() => {
    try { return JSON.parse(idea.screenshots || "[]"); }
    catch { return []; }
  })();

  return (
    <div className="min-h-screen bg-cream">
      {/* Navbar */}
      <nav className="navbar-glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">返回</span>
            </Link>
            <span className="text-border">|</span>
            <Link href="/" className="font-serif text-base font-bold text-gold hover:text-gold-light transition-colors">
              CoBuilder
            </Link>
          </div>
          <StatusTag status={idea.status} size="sm" />
        </div>
      </nav>

      <main className="pt-20 max-w-3xl mx-auto px-4 sm:px-6 pb-20">
        {/* Breadcrumb */}
        <div className="py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            需求管理池
          </Link>
        </div>

        {/* Main Content */}
        <article className="card p-6 sm:p-8 mb-5 animate-fade-in">
          {/* Title & Status */}
          <div className="flex items-start gap-3 mb-4">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink leading-tight flex-1">
              {idea.title}
            </h1>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted mb-6 pb-5 border-b border-border">
            <span className="font-medium text-ink">{idea.author_name}</span>
            <span>·</span>
            <span>{formatDate(idea.created_at)}</span>
            {idea.version && (
              <>
                <span>·</span>
                <span className="chip">v{idea.version}</span>
              </>
            )}
            <span className="ml-auto">
              <StatusTag status={idea.status} />
            </span>
          </div>

          {/* Description */}
          <MarkdownRenderer content={idea.description} className="text-sm" />

          {/* Screenshots */}
          {screenshots.length > 0 && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {screenshots.map((url: string, i: number) => (
                <div key={i} className="aspect-video rounded-xl overflow-hidden bg-surface border border-border">
                  <img src={url} alt={`截图 ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          {/* Vote */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center gap-4">
              <button
                onClick={handleVote}
                disabled={voteLoading || hasVoted}
                className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-medium text-sm transition-all border ${
                  hasVoted
                    ? "bg-gold-subtle text-gold border-gold-border cursor-default"
                    : "bg-surface hover:bg-gold-subtle text-ink hover:text-gold border-border hover:border-gold-border active:scale-[0.97]"
                } disabled:opacity-60`}
              >
                {voteLoading ? (
                  <div className="spinner spinner-sm" />
                ) : (
                  <svg
                    className={`w-4 h-4 ${hasVoted ? "text-gold" : "text-muted"}`}
                    fill={hasVoted ? "currentColor" : "none"}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                )}
                <span>{hasVoted ? "已投票" : "投票支持"}</span>
                <span className="font-bold text-base">{idea.votes}</span>
              </button>
              {!hasVoted && (
                <p className="text-xs text-muted-light">投票表示你也有这个需求</p>
              )}
            </div>
          </div>
        </article>

        {/* Clarification Doc */}
        {idea.clarification_doc && (
          <section className="card p-6 sm:p-8 mb-5 animate-fade-in">
            <div className="section-header">
              <div className="section-header-accent" />
              <div>
                <h2 className="font-serif text-lg font-bold text-ink">AI 澄清文档</h2>
                <p className="text-xs text-muted mt-0.5">由 AI 自动分析生成</p>
              </div>
              <span className="ml-auto badge badge-published text-[10px]">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                已生成
              </span>
            </div>
            <div className="bg-surface rounded-xl p-5 border border-border">
              <MarkdownRenderer content={idea.clarification_doc} className="text-sm" />
            </div>
          </section>
        )}

        {/* Comments */}
        <CommentSection ideaId={ideaId} initialComments={comments} />
      </main>
    </div>
  );
}
