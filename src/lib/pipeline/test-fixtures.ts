import type { PRD, UIBrief, DevPlan, TestDoc } from '@/lib/db/types';

export function samplePRD(): PRD {
  return {
    title: '测试功能',
    background: '背景说明',
    goal: '目标说明',
    user_value: '用户价值说明',
    out_of_scope: '',
    acceptance_criteria: ['验收标准一', '验收标准二', '验收标准三'],
    feasibility: { level: 'high', note: '可行性说明' },
    priority: 'P1',
    priority_reason: '这是优先级理由说明文字，需要超过二十个字符才合法',
    effort_days: 1,
    confidence: 80,
  };
}

export function sampleUIBrief(): UIBrief {
  return {
    pages: [
      {
        name: '首页',
        layout_description: '顶部导航与主内容区',
        key_interactions: [{ element: '按钮', behavior: '点击进入详情' }],
      },
    ],
    style_notes: '简洁风格',
  };
}

export function sampleDevPlan(): DevPlan {
  return {
    affected_files: [{ path: 'src/demo.ts', modify_type: 'add', brief_reason: '新增演示文件' }],
    steps: ['分析', '实现', '自测'],
    api_changes: [],
    risks: [],
    codebase_scanned: false,
    scan_note: '测试扫描',
  };
}

export function sampleTestDoc(): TestDoc {
  return {
    test_cases: [
      {
        id: 'TC-001',
        title: '用例一',
        preconditions: '无',
        steps: ['打开页面'],
        expected_result: '显示正常',
        criteria_ref: 0,
      },
      {
        id: 'TC-002',
        title: '用例二',
        preconditions: '无',
        steps: ['执行操作'],
        expected_result: '结果正确',
        criteria_ref: 1,
      },
      {
        id: 'TC-003',
        title: '用例三',
        preconditions: '无',
        steps: ['验证'],
        expected_result: '通过',
        criteria_ref: 2,
      },
    ],
    coverage_note: '覆盖全部验收标准',
  };
}

export function mimoRouter(prompt: string): string {
  if (prompt.includes('产品经理') || prompt.includes('PRD JSON')) {
    return JSON.stringify(samplePRD());
  }
  if (prompt.includes('UI_Brief') || prompt.includes('设计师')) {
    return JSON.stringify(sampleUIBrief());
  }
  if (prompt.includes('Dev_Plan')) {
    return JSON.stringify(sampleDevPlan());
  }
  if (prompt.includes('Test_Doc') || prompt.includes('测试工程师')) {
    return JSON.stringify(sampleTestDoc());
  }
  if (prompt.includes('生成文件') || prompt.includes('完整代码')) {
    return 'export const demo = true;\n';
  }
  return '{}';
}
