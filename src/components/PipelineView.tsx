"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ───────── Types ───────── */

interface PipelineStage {
  stage: string;
  label: string;
  agent?: string;
  status: "not_started" | "running" | "completed" | "failed" | "gate_waiting";
  output?: Record<string, unknown>;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

interface PipelineData {
  id: string;
  idea_id: string;
  status: string;
  current_stage: string;
  stages: PipelineStage[];
  created_at: string;
  updated_at: string;
}

interface PipelineRunRecord {
  id: string;
  idea_id: string;
  stage: string;
  agent_id: string | null;
  status: string;
  output_data: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface PipelineApiResponse {
  pipeline_runs: PipelineRunRecord[];
}

const STAGE_DEFS = [
  { key: "intent_analysis", label: "意图分析", icon: "🎯" },
  { key: "doc_generation", label: "需求生成", icon: "📝" },
] as const;

const STAGE_LABELS: Record<string, string> = {
  intent_analysis: "意图分析",
  doc_generation: "需求生成",
  code_review: "代码审查",
  requirement_gen: "需求生成",
  document_review: "文档审核",
  publish: "发布",
};

type StageStatus = PipelineStage["status"];

const STATUS_STYLE: Record<StageStatus, { bg: string; ring: string; icon: string; label: string }> = {
  completed: { bg: "bg-emerald-500", ring: "ring-emerald-200", icon: "✅", label: "已完成" },
  running: { bg: "bg-amber-500", ring: "ring-amber-200", icon: "⏳", label: "运行中" },
  gate_waiting: { bg: "bg-blue-500", ring: "ring-blue-200", icon: "🔒", label: "待审核" },
  not_started: { bg: "bg-gray-300", ring: "ring-gray-100", icon: "⬜", label: "未开始" },
  failed: { bg: "bg-red-500", ring: "ring-red-200", icon: "❌", label: "失败" },
};

/* ───────── Component ───────── */

export default function PipelineView({ ideaId }: { ideaId: string }) {
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---- fetch pipeline ---- */
  const fetchPipeline = useCallback(async () => {
    try {
      const token = localStorage.getItem("cobuilder_admin_token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/pipeline/${ideaId}`, { headers });
      if (res.status === 404) {
        setPipeline(null);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("加载流水线失败");
      const data: PipelineApiResponse = await res.json();
      setPipeline(transformPipelineResponse(data));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  /* ---- poll when running ---- */
  useEffect(() => {
    const hasRunning = pipeline?.stages?.some((s) => s.status === "running");
    if (hasRunning) {
      pollRef.current = setInterval(fetchPipeline, 3000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pipeline, fetchPipeline]);

  /* ---- actions ---- */
  const startPipeline = async () => {
    setActionLoading("start");
    try {
      const token = localStorage.getItem("cobuilder_admin_token");
      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      };
      const res = await fetch("/api/pipeline/start", {
        method: "POST",
        headers,
        body: JSON.stringify({ idea_id: ideaId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "启动失败");
      }
      await fetchPipeline();
    } catch (e) {
      alert(e instanceof Error ? e.message : "启动失败");
    } finally {
      setActionLoading(null);
    }
  };

  const advancePipeline = async () => {
    setActionLoading("advance");
    try {
      const token = localStorage.getItem("cobuilder_admin_token");
      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      };
      const res = await fetch("/api/pipeline/advance", {
        method: "POST",
        headers,
        body: JSON.stringify({ idea_id: ideaId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "推进失败");
      }
      await fetchPipeline();
    } catch (e) {
      alert(e instanceof Error ? e.message : "推进失败");
    } finally {
      setActionLoading(null);
    }
  };

  const retryStage = async (stage: string) => {
    setActionLoading(`retry-${stage}`);
    try {
      const token = localStorage.getItem("cobuilder_admin_token");
      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      };
      const res = await fetch("/api/pipeline/advance", {
        method: "POST",
        headers,
        body: JSON.stringify({ idea_id: ideaId, stage, retry: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "重试失败");
      }
      await fetchPipeline();
    } catch (e) {
      alert(e instanceof Error ? e.message : "重试失败");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* ---- loading / empty states ---- */
  if (loading) {
    return (
      <div className="bg-paper rounded-xl border border-border p-5">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted">加载流水线…</span>
        </div>
      </div>
    );
  }

  if (error && !pipeline) {
    return (
      <div className="bg-paper rounded-xl border border-red-200 p-5">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  /* No pipeline yet — show start button */
  if (!pipeline) {
    return (
      <div className="bg-paper rounded-xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-sm font-bold text-ink">流水线进度</h3>
            <p className="text-xs text-muted mt-1">尚未启动自动化流水线</p>
          </div>
          <button
            onClick={startPipeline}
            disabled={actionLoading === "start"}
            className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-white text-sm font-medium px-4 py-2 rounded-lg transition-all disabled:opacity-50"
          >
            {actionLoading === "start" ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            启动流水线
          </button>
        </div>
      </div>
    );
  }

  /* ---- find stage status helper ---- */
  const stages = pipeline.stages ?? [];

  const getStageStatus = (key: string): StageStatus => {
    const found = stages.find((s) => s.stage === key);
    return found?.status ?? "not_started";
  };

  const getStageData = (key: string): PipelineStage | undefined => {
    return stages.find((s) => s.stage === key);
  };

  const hasRunning = stages.some((s) => s.status === "running");

  /* ---- render ---- */
  return (
    <div className="bg-paper rounded-xl border border-border p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-sm font-bold text-ink">流水线进度</h3>
          <p className="text-xs text-muted mt-0.5">
            状态: <span className="font-medium text-ink">{pipeline.status}</span>
          </p>
        </div>
        {!pipeline && (
          <button
            onClick={startPipeline}
            disabled={actionLoading === "start"}
            className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
          >
            启动流水线
          </button>
        )}
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between px-2">
        {STAGE_DEFS.map((def, idx) => {
          const st = getStageStatus(def.key);
          const style = STATUS_STYLE[st];
          return (
            <div key={def.key} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ring-2 ${style.bg} ${style.ring} text-white shadow-sm ${st === "running" ? "animate-pulse" : ""}`}
                >
                  {style.icon}
                </div>
                <span className="text-[10px] text-muted mt-1.5 text-center leading-tight max-w-[56px]">
                  {def.label}
                </span>
              </div>
              {/* Connector line */}
              {idx < STAGE_DEFS.length - 1 && (
                <div className="flex-1 h-0.5 mx-1 bg-border" />
              )}
            </div>
          );
        })}
      </div>

      {/* Stage detail cards */}
      <div className="space-y-2 pt-2 border-t border-border">
        {STAGE_DEFS.map((def) => {
          const data = getStageData(def.key);
          const st = getStageStatus(def.key);
          const style = STATUS_STYLE[st];
          const expanded = expandedStages.has(def.key);
          const canRetry = st === "failed";
          const canAdvance = st === "gate_waiting" && !hasRunning;

          return (
            <div
              key={def.key}
              className={`rounded-lg border transition-colors ${
                st === "running"
                  ? "border-amber-300 bg-amber-50/50"
                  : st === "failed"
                    ? "border-red-200 bg-red-50/30"
                    : "border-border bg-cream/50"
              }`}
            >
              {/* Summary row */}
              <button
                onClick={() => toggleExpand(def.key)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{style.icon}</span>
                  <span className="text-xs font-medium text-ink">{def.label}</span>
                  {data?.agent && (
                    <span className="text-[10px] text-muted px-1.5 py-0.5 bg-border/50 rounded">
                      {data.agent}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">{style.label}</span>
                  <svg
                    className={`w-3.5 h-3.5 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded details */}
              {expanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-border/50">
                  {data?.agent && (
                    <p className="text-[11px] text-muted pt-2">
                      执行代理: <span className="font-medium text-ink">{data.agent}</span>
                    </p>
                  )}

                  {data?.started_at && (
                    <p className="text-[11px] text-muted">
                      开始时间: {formatTime(data.started_at)}
                      {data.completed_at && `  ·  结束: ${formatTime(data.completed_at)}`}
                    </p>
                  )}

                  {data?.error && (
                    <div className="p-2 rounded bg-red-100 border border-red-200">
                      <p className="text-[11px] text-red-600 font-medium mb-0.5">错误信息</p>
                      <p className="text-[11px] text-red-500">{data.error}</p>
                    </div>
                  )}

                  {data?.output && (
                    <div className="rounded bg-cream border border-border p-2">
                      <p className="text-[10px] text-muted mb-1 font-medium">输出数据</p>
                      <pre className="text-[10px] text-ink/70 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                        {JSON.stringify(data.output, null, 2)}
                      </pre>
                    </div>
                  )}

                  {!data?.output && st === "completed" && (
                    <p className="text-[11px] text-muted/60 italic">无输出数据</p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    {canRetry && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          retryStage(def.key);
                        }}
                        disabled={actionLoading === `retry-${def.key}`}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded transition-all disabled:opacity-50"
                      >
                        {actionLoading === `retry-${def.key}` ? (
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          "🔄"
                        )}
                        重试
                      </button>
                    )}
                    {canAdvance && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          advancePipeline();
                        }}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded transition-all disabled:opacity-50"
                      >
                        {actionLoading === "advance" ? (
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          "▶"
                        )}
                        推进
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Global action */}
      {!hasRunning && !stages.some((s) => s.status === "gate_waiting") && (
        <div className="flex justify-center pt-1">
          <button
            onClick={startPipeline}
            disabled={!!actionLoading}
            className="inline-flex items-center gap-2 text-xs font-medium text-gold hover:text-gold-light transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            重新启动流水线
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────── Helpers ───────── */

function mapRunStatus(status: string): StageStatus {
  switch (status) {
    case "pending":
      return "not_started";
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "gate_waiting":
      return "gate_waiting";
    default:
      return "not_started";
  }
}

function tryParseJson(raw: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function transformPipelineResponse(data: PipelineApiResponse): PipelineData | null {
  const runs = data.pipeline_runs ?? [];
  if (runs.length === 0) return null;

  const stageMap = new Map<string, PipelineRunRecord>();
  for (const run of runs) {
    stageMap.set(run.stage, run);
  }

  const stages: PipelineStage[] = Array.from(stageMap.entries()).map(([stage, run]) => ({
    stage,
    label: STAGE_LABELS[stage] ?? stage,
    agent: run.agent_id ?? undefined,
    status: mapRunStatus(run.status),
    output: run.output_data ? tryParseJson(run.output_data) : undefined,
    error: run.error ?? undefined,
    started_at: run.started_at ?? undefined,
    completed_at: run.completed_at ?? undefined,
  }));

  const hasRunning = stages.some((s) => s.status === "running");
  const hasFailed = stages.some((s) => s.status === "failed");
  const allCompleted = stages.length > 0 && stages.every((s) => s.status === "completed");

  let status = "in_progress";
  if (hasRunning) status = "running";
  else if (hasFailed) status = "failed";
  else if (allCompleted) status = "completed";

  const currentStage =
    stages.find((s) => s.status === "running")?.stage ??
    stages.find((s) => s.status !== "completed" && s.status !== "failed")?.stage ??
    stages[stages.length - 1]?.stage ??
    "";

  const lastRun = runs[runs.length - 1];

  return {
    id: runs[0].idea_id,
    idea_id: runs[0].idea_id,
    status,
    current_stage: currentStage,
    stages,
    created_at: runs[0].created_at,
    updated_at: lastRun.completed_at ?? lastRun.created_at,
  };
}

function formatTime(iso: string) {
  const d = new Date(iso + "Z");
  return d.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
