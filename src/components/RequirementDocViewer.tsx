"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

/* ───────── Types ───────── */

interface RequirementDoc {
  id: string;
  idea_id: string;
  version: number;
  content: string;
  agent: string;
  generated_at: string;
  review_status: "pending" | "approved" | "rejected" | "edited";
  reviewer?: string;
  reviewed_at?: string;
  review_comment?: string;
}

/* ───────── Component ───────── */

export default function RequirementDocViewer({ ideaId }: { ideaId: string }) {
  const [doc, setDoc] = useState<RequirementDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Gate review state */
  const [showEditModal, setShowEditModal] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<string | null>(null);

  const fetchDoc = useCallback(async () => {
    try {
      const token = localStorage.getItem("cobuilder_admin_token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/pipeline/${ideaId}/requirement-doc`, { headers });
      if (res.status === 404) {
        setDoc(null);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("加载需求文档失败");
      const data: RequirementDoc = await res.json();
      setDoc(data);
      setEditContent(data.content);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    fetchDoc();
  }, [fetchDoc]);

  /* ---- Gate review actions ---- */
  const submitGate = async (decision: "approved" | "edited" | "rejected", content?: string, comment?: string) => {
    setReviewLoading(true);
    setReviewResult(null);
    try {
      const token = localStorage.getItem("cobuilder_admin_token");
      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      };
      const body: Record<string, unknown> = { idea_id: ideaId, decision };
      if (content) body.content = content;
      if (comment) body.comment = comment;

      const res = await fetch("/api/pipeline/gate", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "操作失败");
      }
      setReviewResult("✅ 审核完成");
      setShowEditModal(false);
      setShowRejectModal(false);
      await fetchDoc();
    } catch (e) {
      setReviewResult(e instanceof Error ? e.message : "操作失败");
    } finally {
      setReviewLoading(false);
    }
  };

  /* ---- loading / empty ---- */
  if (loading) {
    return (
      <div className="bg-paper rounded-xl border border-border p-5">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted">加载需求文档…</span>
        </div>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="bg-paper rounded-xl border border-red-200 p-5">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="bg-paper rounded-xl border border-border p-5">
        <h3 className="font-serif text-sm font-bold text-ink mb-1">需求文档</h3>
        <p className="text-xs text-muted">暂无需求文档。请先推进流水线到需求生成阶段。</p>
      </div>
    );
  }

  const REVIEW_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: "待审核", color: "bg-amber-100 text-amber-700" },
    approved: { label: "已通过", color: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "已驳回", color: "bg-red-100 text-red-600" },
    edited: { label: "已编辑通过", color: "bg-blue-100 text-blue-600" },
  };

  const reviewInfo = REVIEW_LABELS[doc.review_status] ?? REVIEW_LABELS.pending;

  return (
    <>
      <div className="bg-paper rounded-xl border border-border p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-sm font-bold text-ink">需求文档</h3>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-border text-muted">
              v{doc.version}
            </span>
          </div>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${reviewInfo.color}`}>
            {reviewInfo.label}
          </span>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-[11px] text-muted">
          <span>
            代理: <span className="font-medium text-ink">{doc.agent}</span>
          </span>
          <span>
            生成时间:{" "}
            <span className="font-medium text-ink">{formatDateTime(doc.generated_at)}</span>
          </span>
          {doc.reviewed_at && (
            <span>
              审核时间:{" "}
              <span className="font-medium text-ink">{formatDateTime(doc.reviewed_at)}</span>
            </span>
          )}
        </div>

        {/* Content */}
        <div className="prose prose-sm max-w-none text-ink/80 bg-cream/50 rounded-lg p-4 border border-border/50">
          <ReactMarkdown>{doc.content}</ReactMarkdown>
        </div>

        {/* Review comment */}
        {doc.review_comment && (
          <div className="p-3 rounded-lg bg-cream border border-border">
            <p className="text-[10px] text-muted font-medium mb-0.5">审核备注</p>
            <p className="text-xs text-ink/70">{doc.review_comment}</p>
          </div>
        )}

        {/* Gate review buttons (only for pending docs) */}
        {doc.review_status === "pending" && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            {/* Approve */}
            <button
              onClick={() => submitGate("approved")}
              disabled={reviewLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              {reviewLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "✅"
              )}
              通过
            </button>

            {/* Edit + Approve */}
            <button
              onClick={() => setShowEditModal(true)}
              disabled={reviewLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gold bg-gold/10 hover:bg-gold/20 border border-gold/30 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              ✏️ 编辑后通过
            </button>

            {/* Reject */}
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={reviewLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              ❌ 驳回
            </button>
          </div>
        )}

        {/* Review result */}
        {reviewResult && (
          <p
            className={`text-xs text-center ${
              reviewResult.startsWith("✅") ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {reviewResult}
          </p>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-paper rounded-xl border border-border shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="font-serif text-sm font-bold text-ink">编辑后通过</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-muted hover:text-ink text-lg"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-64 px-4 py-3 rounded-lg bg-cream border border-border text-sm text-ink font-mono leading-relaxed focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
              <button
                onClick={() => setShowEditModal(false)}
                className="text-xs font-medium text-muted hover:text-ink px-3 py-1.5 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => submitGate("edited", editContent)}
                disabled={reviewLoading || !editContent.trim()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gold bg-gold/10 hover:bg-gold/20 border border-gold/30 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                {reviewLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                ) : (
                  "✏️"
                )}
                编辑后通过
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-paper rounded-xl border border-border shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="font-serif text-sm font-bold text-ink">驳回需求文档</h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-muted hover:text-ink text-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-xs font-medium text-ink">驳回原因</label>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="请输入驳回原因…"
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-cream border border-border text-sm text-ink leading-relaxed focus:outline-none focus:border-red-300 focus:ring-1 focus:ring-red-200 transition-all resize-none placeholder:text-muted/40"
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-xs font-medium text-muted hover:text-ink px-3 py-1.5 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => submitGate("rejected", undefined, rejectComment)}
                disabled={reviewLoading}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                {reviewLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "❌"
                )}
                驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ───────── Helpers ───────── */

function formatDateTime(iso: string) {
  const d = new Date(iso + "Z");
  return d.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
