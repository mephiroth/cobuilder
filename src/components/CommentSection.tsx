"use client";

import React, { useState } from "react";

interface Comment {
  id: string;
  author_name: string;
  content: string;
  is_admin: number;
  created_at: string;
}

interface CommentSectionProps {
  ideaId: string;
  comments: Comment[];
  isAdmin?: boolean;
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHr < 24) return `${diffHr}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  return `${Math.floor(diffDay / 30)}个月前`;
}

function getInitial(name: string): string {
  return name ? name.charAt(0).toUpperCase() : "?";
}

export default function CommentSection({
  ideaId,
  comments: initialComments,
  isAdmin = false,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !content.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/ideas/${ideaId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_name: name.trim(),
          content: content.trim(),
          is_admin: isAdmin,
        }),
      });

      if (!res.ok) {
        throw new Error("提交失败，请重试");
      }

      const newComment: Comment = {
        id: crypto.randomUUID(),
        author_name: name.trim(),
        content: content.trim(),
        is_admin: isAdmin,
        created_at: new Date().toISOString(),
      };

      setComments((prev) => [...prev, newComment]);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          暂无评论，快来发表第一条吧
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                  comment.is_admin ? "bg-[#8B6914]" : "bg-gray-300"
                }`}
              >
                {getInitial(comment.author_name)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-[#2C2C2C]">
                    {comment.author_name}
                  </span>
                  {comment.is_admin && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[#8B6914]/10 text-[#8B6914]">
                      管理员
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {relativeTime(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm text-[#2C2C2C] whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Divider */}
      <hr className="border-[#E8E4DE]" />

      {/* Comment form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            placeholder="你的名字"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#E8E4DE] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B6914]/30 focus:border-[#8B6914] transition-colors bg-white"
            required
          />
        </div>

        <div>
          <textarea
            placeholder="发表你的评论..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-[#E8E4DE] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#8B6914]/30 focus:border-[#8B6914] transition-colors bg-white"
            required
          />
        </div>

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !name.trim() || !content.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-[#8B6914] rounded-lg hover:bg-[#6B5010] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "提交中..." : "发表评论"}
          </button>
        </div>
      </form>
    </div>
  );
}
