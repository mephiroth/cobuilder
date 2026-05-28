import { callMimoWithRetry, MODELS } from '@/lib/ai/client';
import type { TestDoc } from '@/lib/db/types';
import { PLACEHOLDER_TEST_DOC, validateTestDoc } from './validators';
import type { StageModule } from './stage-types';

export const stage4: StageModule<TestDoc> = {
  name: 'stage4_test',
  timeoutSeconds: 60,

  async run(input) {
    const prd = input.previousDocs.prd;
    if (!prd) throw new Error('缺少 PRD');
    try {
      const prompt = `你是测试工程师。根据验收标准生成 Test_Doc JSON。

<acceptance_criteria>${JSON.stringify(prd.acceptance_criteria)}</acceptance_criteria>

test_cases 数量 >= ${prd.acceptance_criteria.length}，每项含 id(TC-001格式), title, preconditions, steps(1-10), expected_result, criteria_ref(0-based索引), coverage_note(1-200)`;

      const raw = await callMimoWithRetry({
        prompt,
        model: MODELS.test,
        system: '只输出合法 JSON',
        retries: 1,
        backoffMs: [1000],
      });
      const doc = validateTestDoc(JSON.parse(raw), prd.acceptance_criteria.length);
      return { doc, docType: 'test_doc' as const };
    } catch {
      return {
        doc: PLACEHOLDER_TEST_DOC,
        docType: 'test_doc' as const,
        meta: { generationFailed: true },
      };
    }
  },
};
