import { callMimoWithRetry, MODELS } from '@/lib/ai/client';
import type { UIBrief } from '@/lib/db/types';
import { validateUIBrief } from './validators';
import type { StageModule } from './stage-types';

export const stage2: StageModule<UIBrief> = {
  name: 'stage2_design',
  timeoutSeconds: 60,

  async run(input) {
    const prd = input.previousDocs.prd;
    if (!prd) throw new Error('缺少 PRD');
    const prompt = `你是 UI 设计师。根据 PRD 生成 UI_Brief JSON（纯文字，无代码无图片）。

<prd>${JSON.stringify(prd)}</prd>

字段：pages(1-10项，每项 name, layout_description, key_interactions[{element,behavior}]), style_notes(0-200)`;

    const raw = await callMimoWithRetry({
      prompt,
      model: MODELS.design,
      system: '只输出合法 JSON',
      retries: 2,
    });
    const doc = validateUIBrief(JSON.parse(raw));
    return { doc, docType: 'ui_brief' as const };
  },
};
