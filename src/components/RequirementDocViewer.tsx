"use client";

import { useState, useEffect, useCallback } from "react";
import MarkdownRenderer from "./MarkdownRenderer";

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

  const [showEditModal, setShowEditModal] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchDoc = useCallback(async () => {
    try {
      const token = localStorage.getItem("cobuilder_admin_token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/pipeline/${ideaId}/requirement-doc`, { headers });
      if (res.status === 404) { setDoc(null); setLoading(false); return; }
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

  useEffect(() => { fetchDoc(); }, [fetchDoc]);

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

      const res = await fetch("/api/pipeline/gate", { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "操作失败"); }
      setReviewResult({ type: "success", message: "审核完成" });
      setShowEditModal(false);
      setShowRejectModal(false);
      await fetchDoc();
    } catch (e) {
      setReviewResult({ type: "error", message: e instanceof Error ? e.message : "操作失败" });
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="spinner" />
          <span className="text-sm text-muted">加载需求文档…</span>
        </div>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="card border-red-200 p-5">
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="card p-5">
        <h3 className="font-serif text-sm font-bold text-ink mb-1">需求文档</h3>
        <p className="text-xs text-muted">暂无需求文档。请先推进流水线到需求生成阶段。</p>
      </div>
    );
  }

  const REVIEW_CONFIG: Record<string, { label: string; className: string }> = {
    pending: { label: "待审核", className: "badge-pending" },
    approved: { label: "已通过", className: "badge-published" },
    rejected: { label: "已驳回", className: "bg-red-100 text-red-700 border-red-200" },
    edited: { label: "编辑通过", className: "badge-clarified" },
  };

  const reviewConfig = REVIEW_CONFIG[doc.review_status] ?? REVIEW_CONFIG.pending;

  return (
    <>
      <div className="card p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-sm font-bold text-ink">需求文档</h3>
            <span className="chip text-[10px] px-1.5 py-0.5 font-mono">v{doc.version}</span>
          </div>
          <span className={`badge ${reviewConfig.className}`}>{reviewConfig.label}</span>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
          <span>代理: <span className="font-medium text-ink">{doc.agent}</span></span>
          <span>生成: <span className="font-medium text-ink">{formatDateTime(doc.generated_at)}</span></span>
          {doc.reviewed_at && (
            <span>审核: <span className="font-medium text-ink">{formatDateTime(doc.reviewed_at)}</span></span>
          )}
        </div>

        {/* Content */}
        <div className="bg-surface rounded-xl p-5 border border-border">
          <MarkdownRenderer content={doc.content} className="text-sm" />
        </div>

        {/* Review Comment */}
        {doc.review_comment && (
          <div className="p-3 rounded-lg bg-surface border border-border">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">审核备注</p>
            <p className="text-xs text-ink-secondary">{doc.review_comment}</p>
          </div>
        )}

        {/* Gate Actions */}
        {doc.review_status === "pending" && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              onClick={() => submitGate("approved")}
              disabled={reviewLoading}
              className="btn btn-secondary text-xs px-3 py-1.5 text-green-700 border-green-200 hover:bg-green-50"
            >
              {reviewLoading ? <div className="spinner spinner-sm" /> : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              通过
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              disabled={reviewLoading}
              className="btn btn-secondary text-xs px-3 py-1.5 text-gold border-gold-border hover:bg-gold-subtle"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              编辑后通过
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={reviewLoading}
              className="btn btn-danger text-xs px-3 py-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              驳回
            </button>
          </div>
        )}

        {/* Review Result */}
        {reviewResult && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
            reviewResult.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-error border border-red-200"
          }`}>
            {reviewResult.type === "success" ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {reviewResult.message}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="modal-content max-w-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <h3 className="font-serif text-base font-bold text-ink">编辑后通过</h3>
              <button onClick={() => setShowEditModal(false)} className="btn btn-ghost p-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="input-base font-mono leading-relaxed resize-none h-64"
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
              <button onClick={() => setShowEditModal(false)} className="btn btn-ghost text-sm px-4 py-2">取消</button>
              <button
                onClick={() => submitGate("edited", editContent)}
                disabled={reviewLoading || !editContent.trim()}
                className="btn btn-secondary text-sm px-4 py-2 text-gold border-gold-border hover:bg-gold-subtle"
              >
                {reviewLoading ? <div className="spinner spinner-sm" /> : null}
                编辑后通过
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowRejectModal(false)}>
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-serif text-base font-bold text-ink">驳回需求文档</h3>
              <button onClick={() => setShowRejectModal(false)} className="btn btn-ghost p-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-3">
              <label className="block text-sm font-medium text-ink">驳回原因</label>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="请输入驳回原因…"
                rows={4}
                className="input-base resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setShowRejectModal(false)} className="btn btn-ghost text-sm px-4 py-2">取消</button>
              <button
                onClick={() => submitGate("rejected", undefined, rejectComment)}
                disabled={reviewLoading}
                className="btn btn-danger text-sm px-4 py-2"
              >
                {reviewLoading ? <div className="spinner spinner-sm" /> : null}
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso + "Z");
  return d.toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
