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
  {
    key: "intent_analysis",
    label: "意图分析",
    description: "AI 分析需求意图、优先级和影响范围",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    key: "doc_generation",
    label: "需求文档",
    description: "AI 读取代码库，生成结构化 PRD",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
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

const STATUS_CONFIG: Record<StageStatus, {
  label: string;
  dotColor: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconBg: string;
}> = {
  completed: {
    label: "已完成",
    dotColor: "bg-green-500",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    textColor: "text-green-700",
    iconBg: "bg-green-500",
  },
  running: {
    label: "运行中",
    dotColor: "bg-amber-500",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    textColor: "text-amber-700",
    iconBg: "bg-amber-500",
  },
  gate_waiting: {
    label: "待审核",
    dotColor: "bg-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    iconBg: "bg-blue-500",
  },
  not_started: {
    label: "未开始",
    dotColor: "bg-gray-300",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    textColor: "text-gray-500",
    iconBg: "bg-gray-300",
  },
  failed: {
    label: "失败",
    dotColor: "bg-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-700",
    iconBg: "bg-red-500",
  },
};

/* ───────── Component ───────── */

export default function PipelineView({ ideaId }: { ideaId: string }) {
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPipeline = useCallback(async () => {
    try {
      const token = localStorage.getItem("cobuilder_admin_token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/pipeline/${ideaId}`, { headers });
      if (res.status === 404) { setPipeline(null); setLoading(false); return; }
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

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  useEffect(() => {
    const hasRunning = pipeline?.stages?.some((s) => s.status === "running");
    if (hasRunning) {
      pollRef.current = setInterval(fetchPipeline, 3000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pipeline, fetchPipeline]);

  const startPipeline = async () => {
    setActionLoading("start");
    try {
      const token = localStorage.getItem("cobuilder_admin_token");
      const res = await fetch("/api/pipeline/start", {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
        body: JSON.stringify({ idea_id: ideaId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "启动失败"); }
      await fetchPipeline();
    } catch (e) { alert(e instanceof Error ? e.message : "启动失败"); }
    finally { setActionLoading(null); }
  };

  const advancePipeline = async () => {
    setActionLoading("advance");
    try {
      const token = localStorage.getItem("cobuilder_admin_token");
      const res = await fetch("/api/pipeline/advance", {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
        body: JSON.stringify({ idea_id: ideaId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "推进失败"); }
      await fetchPipeline();
    } catch (e) { alert(e instanceof Error ? e.message : "推进失败"); }
    finally { setActionLoading(null); }
  };

  const retryStage = async (stage: string) => {
    setActionLoading(`retry-${stage}`);
    try {
      const token = localStorage.getItem("cobuilder_admin_token");
      const res = await fetch("/api/pipeline/advance", {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
        body: JSON.stringify({ idea_id: ideaId, stage, retry: true }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "重试失败"); }
      await fetchPipeline();
    } catch (e) { alert(e instanceof Error ? e.message : "重试失败"); }
    finally { setActionLoading(null); }
  };

  const toggleExpand = (key: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="spinner" />
          <span className="text-sm text-muted">加载流水线…</span>
        </div>
      </div>
    );
  }

  if (error && !pipeline) {
    return (
      <div className="card border-red-200 p-5">
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-sm font-bold text-ink">AI 流水线</h3>
            <p className="text-xs text-muted mt-1">启动后 AI 将自动分析需求并生成文档</p>
          </div>
          <button
            onClick={startPipeline}
            disabled={actionLoading === "start"}
            className="btn btn-primary text-sm px-4 py-2"
          >
            {actionLoading === "start" ? (
              <div className="spinner spinner-sm spinner-white" />
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

  const stages = pipeline.stages ?? [];
  const getStageStatus = (key: string): StageStatus => stages.find((s) => s.stage === key)?.status ?? "not_started";
  const getStageData = (key: string) => stages.find((s) => s.stage === key);
  const hasRunning = stages.some((s) => s.status === "running");

  // Compute overall progress
  const completedCount = stages.filter((s) => s.status === "completed").length;
  const totalStages = STAGE_DEFS.length;

  return (
    <div className="card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-sm font-bold text-ink">AI 流水线</h3>
          <p className="text-xs text-muted mt-0.5">
            {completedCount}/{totalStages} 阶段完成
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasRunning && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              运行中
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-500"
            style={{ width: `${totalStages > 0 ? (completedCount / totalStages) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Stage Steps */}
      <div className="flex items-start gap-0">
        {STAGE_DEFS.map((def, idx) => {
          const st = getStageStatus(def.key);
          const config = STATUS_CONFIG[st];
          const isLast = idx === STAGE_DEFS.length - 1;

          return (
            <div key={def.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                {/* Circle */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${config.iconBg} ${
                    st === "running" ? "animate-pulse" : ""
                  } shadow-sm`}
                >
                  {st === "completed" ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : st === "failed" ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : st === "running" ? (
                    <div className="spinner spinner-sm spinner-white" />
                  ) : st === "gate_waiting" ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold text-white/70">{idx + 1}</span>
                  )}
                </div>
                {/* Label */}
                <span className={`text-[10px] font-medium text-center leading-tight max-w-[60px] ${
                  st === "not_started" ? "text-muted-light" : "text-ink"
                }`}>
                  {def.label}
                </span>
              </div>
              {/* Connector */}
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-2 mb-5 ${
                  getStageStatus(def.key) === "completed" ? "bg-green-400" : "bg-border"
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Stage Detail Cards */}
      <div className="space-y-2 pt-1 border-t border-border">
        {STAGE_DEFS.map((def) => {
          const data = getStageData(def.key);
          const st = getStageStatus(def.key);
          const config = STATUS_CONFIG[st];
          const expanded = expandedStages.has(def.key);
          const canRetry = st === "failed";
          const canAdvance = st === "gate_waiting" && !hasRunning;

          return (
            <div
              key={def.key}
              className={`rounded-xl border transition-colors overflow-hidden ${
                st === "running" ? "border-amber-200 bg-amber-50/40" :
                st === "failed" ? "border-red-200 bg-red-50/30" :
                st === "completed" ? "border-green-200 bg-green-50/20" :
                "border-border bg-surface/50"
              }`}
            >
              <button
                onClick={() => toggleExpand(def.key)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dotColor} ${st === "running" ? "animate-pulse" : ""}`} />
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${st === "not_started" ? "text-muted" : "text-ink"}`}>
                      {def.label}
                    </span>
                    {data?.agent && (
                      <span className="chip text-[10px] px-1.5 py-0.5">{data.agent}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium ${config.textColor}`}>{config.label}</span>
                  <svg
                    className={`w-3.5 h-3.5 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/50">
                  <p className="text-[11px] text-muted pt-3">{def.description}</p>

                  {data?.started_at && (
                    <p className="text-[11px] text-muted">
                      开始: {formatTime(data.started_at)}
                      {data.completed_at && ` · 结束: ${formatTime(data.completed_at)}`}
                    </p>
                  )}

                  {data?.error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-[11px] font-semibold text-red-700 mb-1">错误信息</p>
                      <p className="text-[11px] text-red-600 font-mono">{data.error}</p>
                    </div>
                  )}

                  {data?.output && (
                    <div className="rounded-lg bg-surface border border-border p-3">
                      <p className="text-[10px] text-muted mb-1.5 font-semibold uppercase tracking-wider">输出数据</p>
                      <pre className="text-[10px] text-ink/70 font-mono whitespace-pre-wrap break-all max-h-36 overflow-y-auto leading-relaxed">
                        {JSON.stringify(data.output, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {canRetry && (
                      <button
                        onClick={(e) => { e.stopPropagation(); retryStage(def.key); }}
                        disabled={actionLoading === `retry-${def.key}`}
                        className="btn btn-danger text-xs px-3 py-1.5"
                      >
                        {actionLoading === `retry-${def.key}` ? (
                          <div className="spinner spinner-sm" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                        重试
                      </button>
                    )}
                    {canAdvance && (
                      <button
                        onClick={(e) => { e.stopPropagation(); advancePipeline(); }}
                        disabled={!!actionLoading}
                        className="btn btn-secondary text-xs px-3 py-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        {actionLoading === "advance" ? (
                          <div className="spinner spinner-sm" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          </svg>
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

      {/* Restart */}
      {!hasRunning && !stages.some((s) => s.status === "gate_waiting") && (
        <div className="flex justify-center pt-1">
          <button
            onClick={startPipeline}
            disabled={!!actionLoading}
            className="btn btn-ghost text-xs text-muted hover:text-gold"
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
    case "pending": return "not_started";
    case "running": return "running";
    case "completed": return "completed";
    case "failed": return "failed";
    case "gate_waiting": return "gate_waiting";
    default: return "not_started";
  }
}

function tryParseJson(raw: string): Record<string, unknown> | undefined {
  try { return JSON.parse(raw) as Record<string, unknown>; }
  catch { return undefined; }
}

function transformPipelineResponse(data: PipelineApiResponse): PipelineData | null {
  const runs = data.pipeline_runs ?? [];
  if (runs.length === 0) return null;

  const stageMap = new Map<string, PipelineRunRecord>();
  for (const run of runs) stageMap.set(run.stage, run);

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
    stages[stages.length - 1]?.stage ?? "";

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
  return d.toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
