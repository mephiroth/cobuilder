import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const skills = [
      {
        id: 'intent_analysis',
        name: '意图分析',
        agent_capability: 'llm_chat',
        description: '分析用户需求/反馈的意图，判断类型（bug/feature/improvement），评估优先级和复杂度，为后续流程提供结构化输入。',
        input: '用户需求标题和描述',
        output: '结构化分析结果 JSON（intent_type, summary, complexity, priority 等）',
        model: 'mimo-v2.5-pro',
      },
      {
        id: 'doc_generation',
        name: '需求文档生成',
        agent_capability: 'code_read+code_write',
        description: '基于意图分析结果，自动生成完整的软件需求文档（PRD），包含功能需求、非功能需求、技术方案、测试要点等章节。',
        input: '意图分析输出 + 原始需求',
        output: 'Markdown 格式需求文档',
        model: 'mimo-v2.5-pro',
      },
    ];

    return Response.json({
      skills,
      version: 'mvp-1.0',
      description: 'CoBuilder MVP 流水线技能/阶段列表',
    });
  } catch (error) {
    console.error('GET /api/skills error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
