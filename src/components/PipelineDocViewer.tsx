"use client";

import type { PRD, UIBrief, DevPlan, TestDoc } from "@/lib/db/types";

type DocType = "prd" | "ui_brief" | "dev_plan" | "test_doc";

const DOC_LABELS: Record<DocType, string> = {
  prd: "PRD 需求文档",
  ui_brief: "UI 设计说明",
  dev_plan: "开发计划",
  test_doc: "测试用例",
};

const PRIORITY_LABELS: Record<string, string> = {
  P0: "P0 · 紧急",
  P1: "P1 · 高",
  P2: "P2 · 中",
  P3: "P3 · 低",
};

const FEASIBILITY_LABELS: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const MODIFY_LABELS: Record<string, string> = {
  add: "新增",
  modify: "修改",
  delete: "删除",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wider">{title}</h4>
      <div className="text-sm text-ink-secondary leading-relaxed">{children}</div>
    </section>
  );
}

function PrdView({ doc }: { doc: PRD }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="font-serif text-base font-bold text-ink">{doc.title}</h4>
        <div className="flex flex-wrap gap-1.5">
          <span className="badge badge-clarified text-[10px]">{PRIORITY_LABELS[doc.priority] ?? doc.priority}</span>
          <span className="chip text-[10px]">预估 {doc.effort_days} 人天</span>
          <span className={`chip text-[10px] ${doc.confidence < 60 ? "text-amber-700 bg-amber-50 border-amber-200" : ""}`}>
            置信度 {doc.confidence}%
          </span>
          <span className="chip text-[10px]">可行性 {FEASIBILITY_LABELS[doc.feasibility.level] ?? doc.feasibility.level}</span>
        </div>
      </div>

      <Section title="背景">{doc.background}</Section>
      <Section title="目标">{doc.goal}</Section>
      <Section title="用户价值">{doc.user_value}</Section>
      {doc.out_of_scope ? <Section title="不在范围">{doc.out_of_scope}</Section> : null}

      <Section title="验收标准">
        <ol className="list-decimal list-inside space-y-1.5 marker:text-gold marker:font-semibold">
          {doc.acceptance_criteria.map((c, i) => (
            <li key={i} className="pl-1">{c}</li>
          ))}
        </ol>
      </Section>

      <Section title="优先级理由">{doc.priority_reason}</Section>
      <Section title="可行性说明">{doc.feasibility.note}</Section>
    </div>
  );
}

function UiBriefView({ doc }: { doc: UIBrief }) {
  return (
    <div className="space-y-5">
      {doc.pages.map((page, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface/60 p-4 space-y-3">
          <h4 className="font-serif text-sm font-bold text-ink">{page.name}</h4>
          <Section title="布局描述">{page.layout_description}</Section>
          {page.key_interactions.length > 0 && (
            <Section title="关键交互">
              <ul className="space-y-2">
                {page.key_interactions.map((ki, j) => (
                  <li key={j} className="flex gap-2 text-xs">
                    <span className="font-medium text-ink shrink-0">{ki.element}</span>
                    <span className="text-muted">→</span>
                    <span>{ki.behavior}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      ))}
      {doc.style_notes && <Section title="风格说明">{doc.style_notes}</Section>}
    </div>
  );
}

function DevPlanView({ doc }: { doc: DevPlan }) {
  return (
    <div className="space-y-5">
      <Section title="影响文件">
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface text-muted text-left">
                <th className="px-3 py-2 font-medium">文件</th>
                <th className="px-3 py-2 font-medium w-16">操作</th>
                <th className="px-3 py-2 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              {doc.affected_files.map((f, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-[11px]">{f.path}</td>
                  <td className="px-3 py-2">{MODIFY_LABELS[f.modify_type] ?? f.modify_type}</td>
                  <td className="px-3 py-2 text-muted">{f.brief_reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="实施步骤">
        <ol className="list-decimal list-inside space-y-1 marker:text-gold">
          {doc.steps.map((s, i) => (
            <li key={i} className="pl-1">{s}</li>
          ))}
        </ol>
      </Section>

      {doc.api_changes.length > 0 && (
        <Section title="API 变更">
          <ul className="space-y-1.5 text-xs font-mono">
            {doc.api_changes.map((a, i) => (
              <li key={i}>
                <span className="text-gold font-semibold">{a.method}</span> {a.path}
                {a.description && <span className="text-muted font-sans ml-2">— {a.description}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {doc.risks.length > 0 && (
        <Section title="风险">
          <ul className="list-disc list-inside space-y-1 text-amber-800">
            {doc.risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Section>
      )}

      {doc.scan_note && (
        <p className="text-[11px] text-muted">
          代码库扫描：{doc.codebase_scanned ? "已完成" : "未完成"} · {doc.scan_note}
        </p>
      )}
    </div>
  );
}

function TestDocView({ doc }: { doc: TestDoc }) {
  return (
    <div className="space-y-5">
      {doc.test_cases.length === 0 ? (
        <p className="text-sm text-muted">暂无测试用例，请人工补充。</p>
      ) : (
        <div className="space-y-3">
          {doc.test_cases.map((tc) => (
            <div key={tc.id} className="rounded-xl border border-border bg-surface/60 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="chip text-[10px] font-mono">{tc.id}</span>
                <span className="text-sm font-semibold text-ink">{tc.title}</span>
              </div>
              {tc.preconditions && (
                <p className="text-xs text-muted">前置条件：{tc.preconditions}</p>
              )}
              <ol className="list-decimal list-inside text-xs space-y-0.5 text-ink-secondary">
                {tc.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <p className="text-xs">
                <span className="text-muted">预期结果：</span>
                <span className="text-ink-secondary">{tc.expected_result}</span>
              </p>
            </div>
          ))}
        </div>
      )}
      {doc.coverage_note && <Section title="覆盖说明">{doc.coverage_note}</Section>}
    </div>
  );
}

function parseDoc(type: DocType, raw: Record<string, unknown>): PRD | UIBrief | DevPlan | TestDoc | null {
  try {
    if (type === "prd") return raw as unknown as PRD;
    if (type === "ui_brief") return raw as unknown as UIBrief;
    if (type === "dev_plan") return raw as unknown as DevPlan;
    return raw as unknown as TestDoc;
  } catch {
    return null;
  }
}

export default function PipelineDocViewer({
  type,
  content,
}: {
  type: DocType;
  content: Record<string, unknown> | null | undefined;
}) {
  if (!content) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center">
        <p className="text-sm text-muted">暂无{DOC_LABELS[type]}</p>
      </div>
    );
  }

  const doc = parseDoc(type, content);

  return (
    <div className="rounded-xl border border-border bg-surface/40 p-5">
      {type === "prd" && doc && <PrdView doc={doc as PRD} />}
      {type === "ui_brief" && doc && <UiBriefView doc={doc as UIBrief} />}
      {type === "dev_plan" && doc && <DevPlanView doc={doc as DevPlan} />}
      {type === "test_doc" && doc && <TestDocView doc={doc as TestDoc} />}
    </div>
  );
}
