import type { PRD, UIBrief, DevPlan, TestDoc } from '@/lib/db/types';
import { ValidationError } from './errors';

function len(s: string, min: number, max: number, field: string) {
  if (typeof s !== 'string' || s.length < min || s.length > max) {
    throw new ValidationError(`${field} 长度须在 ${min}-${max} 字符`);
  }
}

export function validatePRD(raw: unknown): PRD {
  const o = raw as Record<string, unknown>;
  len(String(o.title ?? ''), 1, 50, 'title');
  len(String(o.background ?? ''), 1, 200, 'background');
  len(String(o.goal ?? ''), 1, 200, 'goal');
  len(String(o.user_value ?? ''), 1, 200, 'user_value');
  if (typeof o.out_of_scope !== 'string' || o.out_of_scope.length > 200) {
    throw new ValidationError('out_of_scope 无效');
  }
  const ac = o.acceptance_criteria;
  if (!Array.isArray(ac) || ac.length < 3 || ac.length > 10) {
    throw new ValidationError('acceptance_criteria 须 3-10 条');
  }
  ac.forEach((c, i) => len(String(c), 1, 200, `acceptance_criteria[${i}]`));
  const f = o.feasibility as { level?: string; note?: string };
  if (!f || !['high', 'medium', 'low'].includes(f.level ?? '')) {
    throw new ValidationError('feasibility.level 无效');
  }
  len(String(f.note ?? ''), 1, 200, 'feasibility.note');
  if (!['P0', 'P1', 'P2', 'P3'].includes(String(o.priority))) {
    throw new ValidationError('priority 无效');
  }
  len(String(o.priority_reason ?? ''), 20, 500, 'priority_reason');
  const effort = Number(o.effort_days);
  if (!Number.isFinite(effort) || effort < 0.5 || effort > 30 || effort % 0.5 !== 0) {
    throw new ValidationError('effort_days 无效');
  }
  const conf = Number(o.confidence);
  if (!Number.isInteger(conf) || conf < 0 || conf > 100) {
    throw new ValidationError('confidence 须为 0-100 整数');
  }
  return {
    title: String(o.title),
    background: String(o.background),
    goal: String(o.goal),
    user_value: String(o.user_value),
    out_of_scope: String(o.out_of_scope),
    acceptance_criteria: ac.map(String),
    feasibility: { level: f.level as 'high' | 'medium' | 'low', note: String(f.note) },
    priority: o.priority as PRD['priority'],
    priority_reason: String(o.priority_reason),
    effort_days: effort,
    confidence: conf,
  };
}

export function validateUIBrief(raw: unknown): UIBrief {
  const o = raw as Record<string, unknown>;
  const pages = o.pages;
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 10) {
    throw new ValidationError('pages 须 1-10 项');
  }
  const parsed = pages.map((p, i) => {
    const page = p as Record<string, unknown>;
    len(String(page.name ?? ''), 1, 50, `pages[${i}].name`);
    len(String(page.layout_description ?? ''), 1, 500, `pages[${i}].layout_description`);
    const ki = page.key_interactions;
    if (!Array.isArray(ki) || ki.length > 10) throw new ValidationError('key_interactions 无效');
    const interactions = ki.map((k, j) => {
      const item = k as Record<string, unknown>;
      len(String(item.element ?? ''), 1, 50, `element[${j}]`);
      len(String(item.behavior ?? ''), 1, 200, `behavior[${j}]`);
      return { element: String(item.element), behavior: String(item.behavior) };
    });
    return {
      name: String(page.name),
      layout_description: String(page.layout_description),
      key_interactions: interactions,
    };
  });
  if (typeof o.style_notes !== 'string' || o.style_notes.length > 200) {
    throw new ValidationError('style_notes 无效');
  }
  return { pages: parsed, style_notes: String(o.style_notes) };
}

export function validateDevPlan(raw: unknown): DevPlan {
  const o = raw as Record<string, unknown>;
  const files = o.affected_files;
  if (!Array.isArray(files) || files.length < 1 || files.length > 20) {
    throw new ValidationError('affected_files 须 1-20 项');
  }
  const affected = files.map((f, i) => {
    const file = f as Record<string, unknown>;
    len(String(file.path ?? ''), 1, 500, `path[${i}]`);
    if (!['add', 'modify', 'delete'].includes(String(file.modify_type))) {
      throw new ValidationError('modify_type 无效');
    }
    len(String(file.brief_reason ?? ''), 1, 100, `brief_reason[${i}]`);
    return {
      path: String(file.path),
      modify_type: file.modify_type as 'add' | 'modify' | 'delete',
      brief_reason: String(file.brief_reason),
    };
  });
  const steps = o.steps;
  if (!Array.isArray(steps) || steps.length < 3 || steps.length > 15) {
    throw new ValidationError('steps 须 3-15 步');
  }
  steps.forEach((s, i) => len(String(s), 1, 100, `steps[${i}]`));
  const api = o.api_changes;
  if (!Array.isArray(api) || api.length > 10) throw new ValidationError('api_changes 无效');
  const apiChanges = api.map((a) => {
    const item = a as Record<string, unknown>;
    return {
      method: String(item.method ?? 'GET'),
      path: String(item.path ?? '/'),
      description: String(item.description ?? '').slice(0, 200),
    };
  });
  const risks = o.risks;
  if (!Array.isArray(risks) || risks.length > 5) throw new ValidationError('risks 无效');
  risks.forEach((r, i) => len(String(r), 1, 200, `risks[${i}]`));
  return {
    affected_files: affected,
    steps: steps.map(String),
    api_changes: apiChanges,
    risks: risks.map(String),
    codebase_scanned: Boolean(o.codebase_scanned),
    scan_note: String(o.scan_note ?? '').slice(0, 200),
  };
}

export function validateTestDoc(raw: unknown, criteriaCount: number): TestDoc {
  const o = raw as Record<string, unknown>;
  const cases = o.test_cases;
  if (!Array.isArray(cases) || cases.length < criteriaCount) {
    throw new ValidationError('test_cases 数量不足');
  }
  const test_cases = cases.map((c, i) => {
    const tc = c as Record<string, unknown>;
    const id = String(tc.id ?? `TC-${String(i + 1).padStart(3, '0')}`);
    len(String(tc.title ?? ''), 1, 100, 'title');
    if (typeof tc.preconditions !== 'string' || tc.preconditions.length > 200) {
      throw new ValidationError('preconditions 无效');
    }
    const steps = tc.steps;
    if (!Array.isArray(steps) || steps.length < 1 || steps.length > 10) {
      throw new ValidationError('steps 无效');
    }
    steps.forEach((s, j) => len(String(s), 1, 200, `step[${j}]`));
    len(String(tc.expected_result ?? ''), 1, 200, 'expected_result');
    const ref = Number(tc.criteria_ref);
    if (!Number.isInteger(ref) || ref < 0) throw new ValidationError('criteria_ref 无效');
    return {
      id,
      title: String(tc.title),
      preconditions: String(tc.preconditions),
      steps: steps.map(String),
      expected_result: String(tc.expected_result),
      criteria_ref: ref,
    };
  });
  len(String(o.coverage_note ?? ''), 1, 200, 'coverage_note');
  return { test_cases, coverage_note: String(o.coverage_note) };
}

export const PLACEHOLDER_TEST_DOC: TestDoc = {
  test_cases: [],
  coverage_note: '测试用例生成失败，请人工补充',
};
