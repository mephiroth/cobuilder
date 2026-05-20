"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

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

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "待澄清", color: "bg-status-pending/10 text-status-pending border-status-pending/20" },
  clarified: { label: "已澄清", color: "bg-status-clarified/10 text-status-clarified border-status-clarified/20" },
  in_progress: { label: "进行中", color: "bg-status-in_progress/10 text-status-in_progress border-status-in_progress/20" },
  published: { label: "已实现", color: "bg-status-published/10 text-status-published border-status-published/20" },
  deferred: { label: "已搁置", color: "bg-status-deferred/10 text-status-deferred border-status-deferred/20" },
  closed: { label: "已关闭", color: "bg-status-closed/10 text-status-closed border-status-closed/20" },
};

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

function formatRelativeTime(dateStr: string) {
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

export default function IdeaDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const ideaId = params.id;

  const [idea, setIdea] = useState<Idea | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);

  // Comment form
  const [commentName, setCommentName] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ideaRes, commentsRes] = await Promise.all([
        fetch(`/api/ideas/${ideaId}`),
        fetch(`/api/ideas/${ideaId}/comments`),
      ]);

      if (!ideaRes.ok) {
        if (ideaRes.status === 404) {
          throw new Error("想法不存在或已被删除");
        }
        throw new Error("加载想法失败");
      }

      const ideaData = await ideaRes.json();
      setIdea(ideaData);

      if (commentsRes.ok) {
        const commentsData = await commentsRes.json();
        setComments(commentsData);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVote = async () => {
    if (voteLoading || hasVoted) return;
    setVoteLoading(true);
    try {
      // Generate or retrieve a client ID for dedup
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
        setIdea((prev) => (prev ? { ...prev, votes: data.votes } : prev));
        setHasVoted(true);
      } else {
        const data = await res.json();
        if (data.error?.includes("already")) {
          setHasVoted(true);
        }
      }
    } catch {
      // ignore
    } finally {
      setVoteLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || submittingComment) return;

    setSubmittingComment(true);
    setCommentError(null);

    try {
      const res = await fetch(`/api/ideas/${ideaId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_name: commentName.trim() || "匿名",
          content: commentContent.trim(),
        }),
      });

      if (!res.ok) throw new Error("提交评论失败");

      const newComment = await res.json();
      setComments((prev) => [...prev, newComment]);
      setCommentContent("");
    } catch (e) {
      setCommentError(e instanceof Error ? e.message : "提交评论失败");
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !idea) {
    return (
      <div className="min-h-screen bg-cream">
        <nav className="navbar-glass fixed top-0 left-0 right-0 z-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center">
            <Link href="/" className="font-serif text-lg font-bold text-gold hover:text-gold-light transition-colors">
              CoBuilder
            </Link>
          </div>
        </nav>
        <div className="pt-24 max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-muted text-lg mb-4">{error || "想法不存在"}</p>
          <Link href="/" className="text-gold hover:text-gold-light text-sm underline">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[idea.status] || {
    label: idea.status,
    color: "bg-gray-100 text-gray-600 border-gray-200",
  };

  const screenshots: string[] = (() => {
    try {
      return JSON.parse(idea.screenshots || "[]");
    } catch {
      return [];
    }
  })();

  return (
    <div className="min-h-screen bg-cream">
      {/* Navbar */}
      <nav className="navbar-glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
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

      <main className="pt-24 max-w-3xl mx-auto px-4 sm:px-6 pb-20">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回需求管理池
        </Link>

        {/* Idea Header */}
        <article className="bg-paper rounded-xl border border-border p-6 sm:p-8 mb-6 animate-fade-in">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink leading-tight">
              {idea.title}
            </h1>
            <span
              className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}
            >
              {statusInfo.label}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted mb-6">
            <span className="font-medium text-ink">{idea.author_name}</span>
            <span>·</span>
            <span>{formatDate(idea.created_at)}</span>
            {idea.version && (
              <>
                <span>·</span>
                <span className="px-2 py-0.5 rounded bg-border text-xs font-medium">
                  v{idea.version}
                </span>
              </>
            )}
          </div>

          {/* Description */}
          <div className="prose prose-sm max-w-none text-ink/80">
            <ReactMarkdown>{idea.description}</ReactMarkdown>
          </div>

          {/* Screenshots */}
          {screenshots.length > 0 && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {screenshots.map((url: string, i: number) => (
                <div key={i} className="aspect-video rounded-lg overflow-hidden bg-cream border border-border">
                  <img
                    src={url}
                    alt={`截图 ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Vote Section */}
          <div className="mt-8 pt-6 border-t border-border">
            <button
              onClick={handleVote}
              disabled={voteLoading || hasVoted}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                hasVoted
                  ? "bg-gold/10 text-gold border border-gold/20 cursor-default"
                  : "bg-cream hover:bg-gold/10 text-ink hover:text-gold border border-border hover:border-gold/30 active:scale-[0.97]"
              }`}
            >
              <svg
                className={`w-4 h-4 ${hasVoted ? "text-gold" : ""}`}
                fill={hasVoted ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
              {hasVoted ? "已投票" : "投票"}
              <span className="font-bold">{idea.votes}</span>
            </button>
          </div>
        </article>

        {/* Clarification Doc */}
        {idea.clarification_doc && (
          <section className="bg-paper rounded-xl border border-border p-6 sm:p-8 mb-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 bg-gold rounded-full" />
              <h2 className="font-serif text-lg font-bold text-ink">澄清文档</h2>
            </div>
            <div className="prose prose-sm max-w-none text-ink/80">
              <ReactMarkdown>{idea.clarification_doc}</ReactMarkdown>
            </div>
          </section>
        )}

        {/* Comments Section */}
        <section className="bg-paper rounded-xl border border-border p-6 sm:p-8 animate-fade-in">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-5 bg-gold rounded-full" />
            <h2 className="font-serif text-lg font-bold text-ink">
              讨论
              {comments.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted">
                  ({comments.length})
                </span>
              )}
            </h2>
          </div>

          {/* Comment List */}
          {comments.length > 0 ? (
            <div className="space-y-4 mb-8">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex gap-3 animate-fade-in"
                >
                  <div className="w-8 h-8 rounded-full bg-cream border border-border flex items-center justify-center shrink-0">
                    {comment.is_admin ? (
                      <span className="text-xs font-bold text-gold">管</span>
                    ) : (
                      <span className="text-xs text-muted">
                        {comment.author_name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-ink">
                        {comment.author_name}
                      </span>
                      {comment.is_admin ? (
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gold/10 text-gold border border-gold/20">
                          管理员
                        </span>
                      ) : null}
                      <span className="text-xs text-muted/70">
                        {formatRelativeTime(comment.created_at)}
                      </span>
                    </div>
                    <div className="text-sm text-ink/70 leading-relaxed">
                      <ReactMarkdown>{comment.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted/70 mb-8">暂无讨论，来发表第一条评论吧</p>
          )}

          {/* Comment Form */}
          <form onSubmit={handleSubmitComment} className="border-t border-border pt-6">
            <h3 className="text-sm font-medium text-ink mb-4">发表评论</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={commentName}
                onChange={(e) => setCommentName(e.target.value)}
                placeholder="昵称（可选，默认匿名）"
                className="w-full px-4 py-2.5 rounded-lg bg-cream border border-border text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all"
              />
              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="说点什么..."
                rows={4}
                className="w-full px-4 py-2.5 rounded-lg bg-cream border border-border text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all resize-none"
              />
              {commentError && (
                <p className="text-sm text-red-500">{commentError}</p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!commentContent.trim() || submittingComment}
                  className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded-lg text-sm transition-all"
                >
                  {submittingComment ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      提交中...
                    </>
                  ) : (
                    "发表评论"
                  )}
                </button>
              </div>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
