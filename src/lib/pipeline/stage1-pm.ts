import { callMimoWithRetry, MODELS } from '@/lib/ai/client';
import { listRecentDoneIdeas } from '@/lib/db/pipeline-db';
import type { PRD, Project, Idea } from '@/lib/db/types';
import { validatePRD } from './validators';
import type { StageInput, StageModule } from './stage-types';

function buildPRDPrompt(description: string, project: Project, recentTitles: string[]): string {
  return `你是产品经理。根据用户输入生成 PRD JSON。

<user_input>${description}</user_input>
<project_description>${project.description ?? ''}</project_description>
<recent_done_ideas>${recentTitles.join(', ')}</recent_done_ideas>

输出严格 JSON，字段：
title(1-50), background(1-200), goal(1-200), user_value(1-200), out_of_scope(0-200),
acceptance_criteria(数组3-10条，每条1-200), feasibility{level:high|medium|low, note:1-200},
priority(P0|P1|P2|P3), priority_reason(>=20字符), effort_days(0.5-30，0.5步进), confidence(0-100整数)`;
}

export const stage1: StageModule<PRD> = {
  name: 'stage1_pm',
  timeoutSeconds: 120,

  async run(input: StageInput) {
    const { idea, project } = input;
    const recent = listRecentDoneIdeas(project.id, 10);
    const prompt = buildPRDPrompt(idea.description, project, recent.map((r) => r.title));
    const raw = await callMimoWithRetry({
      prompt,
      model: MODELS.pm,
      system: '你是资深产品经理，只输出合法 JSON，不要 markdown。',
      retries: 2,
      backoffMs: [1000, 3000],
    });
    const prd = validatePRD(JSON.parse(raw));
    return { doc: prd, docType: 'prd' as const };
  },
};
