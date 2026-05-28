import type { DocumentType, Idea, Project, PRD, UIBrief, DevPlan } from '@/lib/db/types';

export interface StageInput {
  idea: Idea;
  project: Project;
  previousDocs: {
    prd?: PRD;
    uiBrief?: UIBrief;
    devPlan?: DevPlan;
  };
}

export interface StageModule<TOut = Record<string, unknown>> {
  name: 'stage1_pm' | 'stage2_design' | 'stage3_dev' | 'stage4_test';
  timeoutSeconds: number;
  run(
    input: StageInput,
    onLog?: (chunk: string) => void
  ): Promise<{
    doc: TOut;
    docType: DocumentType;
    meta?: Record<string, unknown>;
  }>;
}
