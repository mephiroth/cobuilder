"use client";

import { useState, useEffect, useCallback } from "react";
import PipelineDocViewer from "@/components/PipelineDocViewer";
import PrdEditorForm, { prdFromRecord } from "@/components/PrdEditorForm";
import type { PRD } from "@/lib/db/types";

interface PipelinePanelProps {
  ideaId: string;
  status: string;
  prd?: Record<string, unknown> | null;
  uiBrief?: Record<string, unknown> | null;
  devPlan?: Record<string, unknown> | null;
  testDoc?: Record<string, unknown> | null;
  lowConfidenceWarning?: boolean;
  testDocGenerationFailed?: boolean;
  onRefresh: () => void;
  getAuthHeaders: () => Record<string, string>;
}

type DocType = "prd" | "ui_brief" | "dev_plan" | "test_doc";

const DOC_TABS: { key: DocType; label: string }[] = [
  { key: "prd", label: "PRD" },
  { key: "ui_brief", label: "UI 设计" },
  { key: "dev_plan", label: "开发计划" },
  { key: "test_doc", label: "测试用例" },
];

const STATUS_HINTS: Record<string, string> = {
  submitted: "点击「启动流水线」后，AI 将分析需求并生成 PRD。",
  analyzing: "AI 正在分析需求并生成 PRD，请稍候…",
  pending_prd: "请审阅下方 PRD 内容，确认无误后通过，或编辑后通过。",
  designing: "AI 正在生成 UI 设计说明…",
  pending_design: "请审阅 UI 设计说明，确认后进入开发阶段。",
  dev_pending: "AI 正在编写代码，可在下方查看实时日志。",
  testing: "正在运行测试…",
  pending_merge: "开发完成，请审阅代码变更后决定是否合入。",
  done: "需求已完成。",
  rejected: "需求已驳回，可重新启动流水线。",
  deferred: "需求已搁置，到期后可重新启动。",
};

export default function PipelinePanel({
  ideaId,
  status,
  prd,
  uiBrief,
  devPlan,
  testDoc,
  lowConfidenceWarning,
  testDocGenerationFailed,
  onRefresh,
  getAuthHeaders,
}: PipelinePanelProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deferUntil, setDeferUntil] = useState("");
  const [showRawJson, setShowRawJson] = useState(false);
  const [activeDoc, setActiveDoc] = useState<DocType>("prd");

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeferModal, setShowDeferModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPrd, setEditPrd] = useState<PRD | null>(null);
  const [rejectAction, setRejectAction] = useState<{ gate: string; decision: string } | null>(null);

  const [diffPreview, setDiffPreview] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "dev_pending") return;
    const es = new EventSource(`/api/ideas/${ideaId}/pipeline/stream`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.chunk) setLogs((prev) => [...prev.slice(-199), data.chunk]);
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [ideaId, status]);

  useEffect(() => {
    if (status === "pending_prd") setActiveDoc("prd");
    else if (status === "pending_design") setActiveDoc("ui_brief");
    else if (status === "pending_merge") setActiveDoc("dev_plan");
  }, [status]);

  const loadDiff = useCallback(async () => {
    const res = await fetch(`/api/admin/ideas/${ideaId}/diff`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    setDiffPreview(data.diff || "(无差异)");
  }, [ideaId, getAuthHeaders]);

  useEffect(() => {
    if (status === "pending_merge") loadDiff();
  }, [status, loadDiff]);

  const callPipeline = useCallback(
    async (action: string, extra?: Record<string, unknown>) => {
      setBusy(true);
      setMessage(null);
      try {
        const res = await fetch(`/api/ideas/${ideaId}/pipeline`, {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "请求失败");
        setMessage({ type: "success", text: "操作成功" });
        onRefresh();
      } catch (e) {
        setMessage({ type: "error", text: e instanceof Error ? e.message : "请求失败" });
      } finally {
        setBusy(false);
      }
    },
    [ideaId, getAuthHeaders, onRefresh]
  );

  const callGate = useCallback(
    async (gate: string, decision: string, extra?: Record<string, unknown>) => {
      setBusy(true);
      setMessage(null);
      try {
        const res = await fetch(`/api/ideas/${ideaId}/gate`, {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ gate, decision, ...extra }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "审核失败");
        if (!data.success) throw new Error(data.error || "审核失败");
        setMessage({ type: "success", text: `审核完成 → ${data.nextStatus}` });
        setShowRejectModal(false);
        setShowDeferModal(false);
        setShowEditModal(false);
        onRefresh();
      } catch (e) {
        setMessage({ type: "error", text: e instanceof Error ? e.message : "审核失败" });
      } finally {
        setBusy(false);
      }
    },
    [ideaId, getAuthHeaders, onRefresh]
  );

  const docMap: Record<DocType, Record<string, unknown> | null | undefined> = {
    prd,
    ui_brief: uiBrief,
    dev_plan: devPlan,
    test_doc: testDoc,
  };

  const docContent = docMap[activeDoc];

  const openRejectModal = (gate: string, decision: string) => {
    setRejectAction({ gate, decision });
    setRejectReason("");
    setShowRejectModal(true);
  };

  const openEditModal = () => {
    if (prd) setEditPrd(prdFromRecord(prd));
    setShowEditModal(true);
  };

  const submitEdit = () => {
    if (!editPrd) return;
    const gate =
      status === "pending_prd" ? "gate1" : status === "pending_design" ? "gate2" : "gate3";
    callGate(gate, "approve_with_edit", { editedDoc: editPrd });
  };

  const submitReject = () => {
    if (!rejectAction) return;
    callGate(rejectAction.gate, rejectAction.decision, { reason: rejectReason });
  };

  const isRunning = ["analyzing", "designing", "dev_pending", "testing"].includes(status);

  return (
    <>
      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">AI 流水线</h3>
            {STATUS_HINTS[status] && (
              <p className="text-xs text-muted mt-1">{STATUS_HINTS[status]}</p>
            )}
          </div>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              运行中
            </span>
          )}
        </div>

        {lowConfidenceWarning && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            建议补充背景信息（PRD 置信度偏低）
          </p>
        )}
        {testDocGenerationFailed && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            测试用例生成失败，请在合入前人工补充
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {DOC_TABS.map(({ key, label }) => {
            const hasContent = !!docMap[key];
            return (
              <button
                key={key}
                type="button"
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  activeDoc === key
                    ? "bg-ink text-white"
                    : hasContent
                      ? "bg-surface border border-border text-ink hover:bg-surface-hover"
                      : "bg-surface border border-border text-muted-light"
                }`}
                onClick={() => setActiveDoc(key)}
              >
                {label}
                {hasContent && activeDoc !== key && (
                  <span className="ml-1 w-1.5 h-1.5 inline-block rounded-full bg-green-500 align-middle" />
                )}
              </button>
            );
          })}
        </div>

        <PipelineDocViewer type={activeDoc} content={docContent} />

        {docContent && (
          <button
            type="button"
            className="text-[11px] text-muted hover:text-ink transition-colors"
            onClick={() => setShowRawJson((v) => !v)}
          >
            {showRawJson ? "隐藏原始 JSON" : "查看原始 JSON"}
          </button>
        )}
        {showRawJson && docContent && (
          <pre className="text-[10px] bg-surface p-3 rounded-lg overflow-auto max-h-40 border border-border font-mono">
            {JSON.stringify(docContent, null, 2)}
          </pre>
        )}

        {status === "pending_merge" && diffPreview !== null && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">代码变更预览</p>
            <pre className="text-[10px] bg-surface p-3 rounded-lg overflow-auto max-h-48 border border-border font-mono">
              {diffPreview.slice(0, 8000)}
              {diffPreview.length > 8000 ? "\n…(已截断)" : ""}
            </pre>
          </div>
        )}

        {/* Gate Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {status === "submitted" && (
            <>
              <button disabled={busy} className="btn btn-primary text-xs" onClick={() => callPipeline("start")}>
                启动流水线
              </button>
              <button
                disabled={busy}
                className="btn btn-secondary text-xs"
                onClick={() => openRejectModal("gate1", "reject")}
              >
                驳回
              </button>
            </>
          )}

          {status === "pending_prd" && (
            <>
              <button disabled={busy} className="btn btn-primary text-xs" onClick={() => callGate("gate1", "approve")}>
                通过 PRD
              </button>
              <button disabled={busy || !prd} className="btn btn-secondary text-xs" onClick={openEditModal}>
                编辑后通过
              </button>
              <button
                disabled={busy}
                className="btn btn-secondary text-xs"
                onClick={() => openRejectModal("gate1", "reject")}
              >
                驳回
              </button>
              <button
                disabled={busy}
                className="btn btn-secondary text-xs"
                onClick={() => { setDeferUntil(""); setRejectReason(""); setShowDeferModal(true); }}
              >
                搁置
              </button>
            </>
          )}

          {status === "pending_design" && (
            <>
              <button disabled={busy} className="btn btn-primary text-xs" onClick={() => callGate("gate2", "approve")}>
                通过设计
              </button>
              <button disabled={busy} className="btn btn-secondary text-xs" onClick={() => callGate("gate2", "skip_design")}>
                跳过设计
              </button>
              <button
                disabled={busy}
                className="btn btn-secondary text-xs"
                onClick={() => openRejectModal("gate2", "regenerate")}
              >
                重新生成
              </button>
              <button
                disabled={busy}
                className="btn btn-secondary text-xs"
                onClick={() => openRejectModal("gate2", "reject_to_prd")}
              >
                退回 PRD
              </button>
            </>
          )}

          {status === "pending_merge" && (
            <>
              <button disabled={busy} className="btn btn-primary text-xs" onClick={() => callGate("gate3", "approve")}>
                合入代码
              </button>
              <button disabled={busy} className="btn btn-secondary text-xs" onClick={() => loadDiff()}>
                刷新 Diff
              </button>
              <button
                disabled={busy}
                className="btn btn-secondary text-xs"
                onClick={() => openRejectModal("gate3", "regenerate")}
              >
                重新开发
              </button>
              <button
                disabled={busy}
                className="btn btn-secondary text-xs"
                onClick={() => openRejectModal("gate3", "reject")}
              >
                驳回合入
              </button>
            </>
          )}

          {status === "dev_pending" && (
            <button disabled={busy} className="btn btn-secondary text-xs" onClick={() => callPipeline("retry_dev")}>
              重试开发
            </button>
          )}

          {(status === "rejected" || status === "deferred") && (
            <button disabled={busy} className="btn btn-primary text-xs" onClick={() => callPipeline("start")}>
              重新启动
            </button>
          )}
        </div>

        {logs.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">开发日志</p>
            <pre className="text-[10px] bg-black/90 text-green-400 p-3 rounded-lg max-h-40 overflow-auto font-mono">
              {logs.join("")}
            </pre>
          </div>
        )}

        {message && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-error border border-red-200"
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Reject / Regenerate Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowRejectModal(false)}>
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-serif text-base font-bold text-ink">填写原因</h3>
              <button onClick={() => setShowRejectModal(false)} className="btn btn-ghost p-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-3">
              <label className="block text-sm font-medium text-ink">原因说明</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="请详细说明原因（至少 10 字）…"
                rows={4}
                className="input-base resize-none"
              />
              <p className="text-[11px] text-muted">{rejectReason.length}/10 字（最少 10 字）</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setShowRejectModal(false)} className="btn btn-ghost text-sm px-4 py-2">取消</button>
              <button
                onClick={submitReject}
                disabled={busy || rejectReason.length < 10}
                className="btn btn-danger text-sm px-4 py-2"
              >
                {busy ? <div className="spinner spinner-sm" /> : null}
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Defer Modal */}
      {showDeferModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowDeferModal(false)}>
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-serif text-base font-bold text-ink">搁置需求</h3>
              <button onClick={() => setShowDeferModal(false)} className="btn btn-ghost p-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">搁置原因</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="请说明搁置原因（至少 10 字）…"
                  rows={3}
                  className="input-base resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">恢复日期</label>
                <input
                  type="datetime-local"
                  value={deferUntil}
                  onChange={(e) => setDeferUntil(e.target.value)}
                  className="input-base"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setShowDeferModal(false)} className="btn btn-ghost text-sm px-4 py-2">取消</button>
              <button
                onClick={() =>
                  callGate("gate1", "defer", {
                    reason: rejectReason,
                    deferUntil: new Date(deferUntil).toISOString(),
                  })
                }
                disabled={busy || rejectReason.length < 10 || !deferUntil}
                className="btn btn-secondary text-sm px-4 py-2"
              >
                {busy ? <div className="spinner spinner-sm" /> : null}
                确认搁置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRD Edit Modal */}
      {showEditModal && editPrd && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="modal-content max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <h3 className="font-serif text-base font-bold text-ink">编辑 PRD 后通过</h3>
              <button onClick={() => setShowEditModal(false)} className="btn btn-ghost p-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <PrdEditorForm value={editPrd} onChange={setEditPrd} />
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
              <button onClick={() => setShowEditModal(false)} className="btn btn-ghost text-sm px-4 py-2">取消</button>
              <button
                onClick={submitEdit}
                disabled={busy}
                className="btn btn-primary text-sm px-4 py-2"
              >
                {busy ? <div className="spinner spinner-sm spinner-white" /> : null}
                保存并通过
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
