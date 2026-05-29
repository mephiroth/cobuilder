"use client";

import type { PRD } from "@/lib/db/types";

interface PrdEditorFormProps {
  value: PRD;
  onChange: (value: PRD) => void;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink mb-1.5">
        {label}
        {hint && <span className="text-muted font-normal ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

export function prdFromRecord(raw: Record<string, unknown>): PRD {
  const feasibility = (raw.feasibility ?? {}) as { level?: string; note?: string };
  return {
    title: String(raw.title ?? ""),
    background: String(raw.background ?? ""),
    goal: String(raw.goal ?? ""),
    user_value: String(raw.user_value ?? ""),
    out_of_scope: String(raw.out_of_scope ?? ""),
    acceptance_criteria: Array.isArray(raw.acceptance_criteria)
      ? raw.acceptance_criteria.map(String)
      : ["", "", ""],
    feasibility: {
      level: (["high", "medium", "low"].includes(feasibility.level ?? "")
        ? feasibility.level
        : "medium") as PRD["feasibility"]["level"],
      note: String(feasibility.note ?? ""),
    },
    priority: (["P0", "P1", "P2", "P3"].includes(String(raw.priority))
      ? raw.priority
      : "P2") as PRD["priority"],
    priority_reason: String(raw.priority_reason ?? ""),
    effort_days: Number(raw.effort_days) || 1,
    confidence: Number.isInteger(Number(raw.confidence)) ? Number(raw.confidence) : 80,
  };
}

export default function PrdEditorForm({ value, onChange }: PrdEditorFormProps) {
  const update = (patch: Partial<PRD>) => onChange({ ...value, ...patch });

  const updateCriteria = (index: number, text: string) => {
    const next = [...value.acceptance_criteria];
    next[index] = text;
    update({ acceptance_criteria: next });
  };

  const addCriteria = () => {
    if (value.acceptance_criteria.length >= 10) return;
    update({ acceptance_criteria: [...value.acceptance_criteria, ""] });
  };

  const removeCriteria = (index: number) => {
    if (value.acceptance_criteria.length <= 3) return;
    update({ acceptance_criteria: value.acceptance_criteria.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <Field label="标题" hint="1-50 字">
        <input
          className="input-base text-sm"
          value={value.title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="优先级">
          <select
            className="input-base text-sm"
            value={value.priority}
            onChange={(e) => update({ priority: e.target.value as PRD["priority"] })}
          >
            {(["P0", "P1", "P2", "P3"] as const).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="人天" hint="0.5-30">
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="30"
            className="input-base text-sm"
            value={value.effort_days}
            onChange={(e) => update({ effort_days: Number(e.target.value) })}
          />
        </Field>
        <Field label="置信度" hint="0-100">
          <input
            type="number"
            min="0"
            max="100"
            className="input-base text-sm"
            value={value.confidence}
            onChange={(e) => update({ confidence: Number(e.target.value) })}
          />
        </Field>
        <Field label="可行性">
          <select
            className="input-base text-sm"
            value={value.feasibility.level}
            onChange={(e) =>
              update({
                feasibility: {
                  ...value.feasibility,
                  level: e.target.value as PRD["feasibility"]["level"],
                },
              })
            }
          >
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </Field>
      </div>

      <Field label="背景" hint="1-200 字">
        <textarea
          className="input-base text-sm resize-none"
          rows={2}
          value={value.background}
          onChange={(e) => update({ background: e.target.value })}
        />
      </Field>

      <Field label="目标" hint="1-200 字">
        <textarea
          className="input-base text-sm resize-none"
          rows={2}
          value={value.goal}
          onChange={(e) => update({ goal: e.target.value })}
        />
      </Field>

      <Field label="用户价值" hint="1-200 字">
        <textarea
          className="input-base text-sm resize-none"
          rows={2}
          value={value.user_value}
          onChange={(e) => update({ user_value: e.target.value })}
        />
      </Field>

      <Field label="不在范围" hint="可选，≤200 字">
        <textarea
          className="input-base text-sm resize-none"
          rows={2}
          value={value.out_of_scope}
          onChange={(e) => update({ out_of_scope: e.target.value })}
        />
      </Field>

      <Field label="验收标准" hint="3-10 条">
        <div className="space-y-2">
          {value.acceptance_criteria.map((c, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-xs text-muted mt-2.5 w-5 shrink-0">{i + 1}.</span>
              <input
                className="input-base text-sm flex-1"
                value={c}
                onChange={(e) => updateCriteria(i, e.target.value)}
                placeholder={`验收标准 ${i + 1}`}
              />
              {value.acceptance_criteria.length > 3 && (
                <button
                  type="button"
                  className="text-xs text-muted hover:text-error px-2"
                  onClick={() => removeCriteria(i)}
                >
                  删除
                </button>
              )}
            </div>
          ))}
          {value.acceptance_criteria.length < 10 && (
            <button type="button" className="text-xs text-gold hover:underline" onClick={addCriteria}>
              + 添加验收标准
            </button>
          )}
        </div>
      </Field>

      <Field label="优先级理由" hint="≥20 字">
        <textarea
          className="input-base text-sm resize-none"
          rows={3}
          value={value.priority_reason}
          onChange={(e) => update({ priority_reason: e.target.value })}
        />
      </Field>

      <Field label="可行性说明" hint="1-200 字">
        <textarea
          className="input-base text-sm resize-none"
          rows={2}
          value={value.feasibility.note}
          onChange={(e) =>
            update({
              feasibility: { ...value.feasibility, note: e.target.value },
            })
          }
        />
      </Field>
    </div>
  );
}
