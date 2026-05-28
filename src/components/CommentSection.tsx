"use client";

import { useState } from "react";
import MarkdownRenderer from "./MarkdownRenderer";

interface Comment {
  id: string;
  idea_id: string;
  author_name: string;
  content: string;
  is_admin: number;
  created_at: string;
}

interface CommentSectionProps {
  ideaId: string;
  initialComments: Comment[];
}

function formatRelativeTime(dateStr: string) {
  const d = new Date(dateStr + "Z");
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export default function CommentSection({ ideaId, initialComments }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [commentName, setCommentName] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

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
      setError(e instanceof Error ? e.message : "提交评论失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card p-6 sm:p-8">
      {/* Header */}
      <div className="section-header">
        <div className="section-header-accent" />
        <h2 className="font-serif text-lg font-bold text-ink">
          讨论
          {comments.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted">({comments.length})</span>
          )}
        </h2>
      </div>

      {/* Comment List */}
      {comments.length > 0 ? (
        <div className="space-y-5 mb-8">
          {comments.map((comment, idx) => (
            <div
              key={comment.id}
              className="flex gap-3 animate-fade-in"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  comment.is_admin
                    ? "bg-gold-subtle text-gold border border-gold-border"
                    : "bg-surface-hover text-muted border border-border"
                }`}
              >
                {comment.is_admin ? "管" : getInitial(comment.author_name)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-ink">{comment.author_name}</span>
                  {comment.is_admin ? (
                    <span className="badge badge-clarified text-[10px] px-1.5 py-0.5">管理员</span>
                  ) : null}
                  <span className="text-xs text-muted-light">{formatRelativeTime(comment.created_at)}</span>
                </div>
                <div className="text-sm text-ink-secondary leading-relaxed">
                  <MarkdownRenderer content={comment.content} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-light mb-8 py-4 text-center">
          暂无讨论，来发表第一条评论吧
        </p>
      )}

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-ink mb-4">发表评论</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={commentName}
            onChange={(e) => setCommentName(e.target.value)}
            placeholder="昵称（可选，默认匿名）"
            className="input-base"
          />
          <textarea
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
            placeholder="说点什么..."
            rows={4}
            className="input-base resize-none"
          />
          {error && (
            <p className="text-sm text-error">{error}</p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!commentContent.trim() || submitting}
              className="btn btn-primary text-sm px-5 py-2"
            >
              {submitting ? (
                <>
                  <div className="spinner spinner-sm spinner-white" />
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
  );
}
