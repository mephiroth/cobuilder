"use client";

import { useState, useEffect, useCallback } from "react";

interface PipelinePanelProps {
  ideaId: string;
  status: string;
  prd?: Record<string, unknown> | null;
  lowConfidenceWarning?: boolean;
  testDocGenerationFailed?: boolean;
  onRefresh: () => void;
  getAuthHeaders: () => Record<string, string>;
}

export default function PipelinePanel({
  ideaId,
  status,
  prd,
  lowConfidenceWarning,
  testDocGenerationFailed,
  onRefresh,
  getAuthHeaders,
}: PipelinePanelProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
        setMessage(`操作成功：${JSON.stringify(data)}`);
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

      {prd && (
        <pre className="text-xs bg-surface p-3 rounded-lg overflow-auto max-h-48 border border-border">
          {JSON.stringify(prd, null, 2)}
        </pre>
      )}

      <div className="flex flex-wrap gap-2">
        {status === "submitted" && (
          <>
            <button disabled={busy} className="btn btn-primary text-xs" onClick={() => callPipeline("start")}>
              启动流水线
            </button>
            <input
              className="input-base text-xs flex-1 min-w-[120px]"
              placeholder="驳回原因（≥10字）"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
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
            <button disabled={busy} className="btn btn-secondary text-xs" onClick={() => callGate("gate1", "reject", { reason: rejectReason || "不符合产品方向，需要重新描述" })}>
              驳回
            </button>
          </>
        )}
        {status === "pending_design" && (
          <button disabled={busy} className="btn btn-primary text-xs" onClick={() => callGate("gate2", "approve")}>
            通过设计
          </button>
        )}
        {status === "pending_merge" && (
          <>
            <button disabled={busy} className="btn btn-primary text-xs" onClick={() => callGate("gate3", "approve")}>
              合入代码
            </button>
            <button disabled={busy} className="btn btn-secondary text-xs" onClick={() => callGate("gate3", "regenerate", { reason: "需要重新生成代码与测试" })}>
              重新开发
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
