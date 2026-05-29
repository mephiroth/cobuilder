"use client";

import { useState, useEffect, useCallback } from "react";

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
  const [message, setMessage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deferUntil, setDeferUntil] = useState("");
  const [editJson, setEditJson] = useState("");
  const [diffPreview, setDiffPreview] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<"prd" | "ui_brief" | "dev_plan" | "test_doc">("prd");

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
        setMessage(`操作成功`);
        onRefresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "请求失败");
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
        if (!res.ok) throw new Error(data.error || "Gate 失败");
        if (!data.success) throw new Error(data.error || "Gate 失败");
        setMessage(`Gate 完成 → ${data.nextStatus}`);
        onRefresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Gate 失败");
      } finally {
        setBusy(false);
      }
    },
    [ideaId, getAuthHeaders, onRefresh]
  );

  const docContent =
    activeDoc === "prd"
      ? prd
      : activeDoc === "ui_brief"
        ? uiBrief
        : activeDoc === "dev_plan"
          ? devPlan
          : testDoc;

  const gate1Edit = () => {
    try {
      const editedDoc = editJson.trim() ? JSON.parse(editJson) : undefined;
      return callGate("gate1", "approve_with_edit", { editedDoc });
    } catch {
      setMessage("JSON 格式无效");
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-ink">AI 流水线</h3>

      {lowConfidenceWarning && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
          建议补充背景信息（PRD 置信度偏低）
        </p>
      )}
      {testDocGenerationFailed && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
          测试用例生成失败，请在合入前人工补充
        </p>
      )}

      <div className="flex flex-wrap gap-1">
        {(["prd", "ui_brief", "dev_plan", "test_doc"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`text-xs px-2 py-1 rounded ${activeDoc === t ? "bg-ink text-white" : "bg-surface border border-border"}`}
            onClick={() => setActiveDoc(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {docContent && (
        <pre className="text-xs bg-surface p-3 rounded-lg overflow-auto max-h-48 border border-border">
          {JSON.stringify(docContent, null, 2)}
        </pre>
      )}

      {status === "pending_merge" && diffPreview !== null && (
        <pre className="text-[10px] bg-surface p-3 rounded-lg overflow-auto max-h-40 border border-border font-mono">
          {diffPreview.slice(0, 8000)}
          {diffPreview.length > 8000 ? "\n…(已截断)" : ""}
        </pre>
      )}

      <input
        className="input-base text-xs w-full"
        placeholder="驳回/搁置原因（≥10字）"
        value={rejectReason}
        onChange={(e) => setRejectReason(e.target.value)}
      />
      <input
        className="input-base text-xs w-full"
        type="datetime-local"
        value={deferUntil}
        onChange={(e) => setDeferUntil(e.target.value)}
      />
      <textarea
        className="input-base text-xs w-full font-mono min-h-[60px]"
        placeholder="approve_with_edit：粘贴 JSON 文档"
        value={editJson}
        onChange={(e) => setEditJson(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        {status === "submitted" && (
          <>
            <button disabled={busy} className="btn btn-primary text-xs" onClick={() => callPipeline("start")}>
              启动流水线
            </button>
            <button
              disabled={busy || rejectReason.length < 10}
              className="btn btn-secondary text-xs"
              onClick={() => callPipeline("reject", { reason: rejectReason })}
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
            <button disabled={busy} className="btn btn-secondary text-xs" onClick={() => gate1Edit()}>
              编辑后通过
            </button>
            <button
              disabled={busy || rejectReason.length < 10}
              className="btn btn-secondary text-xs"
              onClick={() => callGate("gate1", "reject", { reason: rejectReason })}
            >
              驳回
            </button>
            <button
              disabled={busy || rejectReason.length < 10 || !deferUntil}
              className="btn btn-secondary text-xs"
              onClick={() =>
                callGate("gate1", "defer", {
                  reason: rejectReason,
                  deferUntil: new Date(deferUntil).toISOString(),
                })
              }
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
              disabled={busy || rejectReason.length < 10}
              className="btn btn-secondary text-xs"
              onClick={() => callGate("gate2", "regenerate", { reason: rejectReason })}
            >
              重新生成
            </button>
            <button
              disabled={busy || rejectReason.length < 10}
              className="btn btn-secondary text-xs"
              onClick={() => callGate("gate2", "reject_to_prd", { reason: rejectReason })}
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
              disabled={busy || rejectReason.length < 10}
              className="btn btn-secondary text-xs"
              onClick={() => callGate("gate3", "regenerate", { reason: rejectReason })}
            >
              重新开发
            </button>
            <button
              disabled={busy || rejectReason.length < 10}
              className="btn btn-secondary text-xs"
              onClick={() => callGate("gate3", "reject", { reason: rejectReason })}
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
        <pre className="text-[10px] bg-black/90 text-green-400 p-3 rounded-lg max-h-40 overflow-auto font-mono">
          {logs.join("")}
        </pre>
      )}

      {message && <p className="text-xs text-muted">{message}</p>}
    </div>
  );
}
