import { NextRequest } from 'next/server';
import { verifyAdmin, adminResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return adminResponse('Unauthorized');
  }

  try {
    const {
      createPipelineRun,
      updatePipelineRun,
      getPipelineRuns,
      getIdea,
      getProject,
      updateIdea,
    } = await import('@/lib/db');
    const mimo = (await import('@/lib/ai/client')).default;

    const body = await request.json();
    const { idea_id, stages } = body;

    if (!idea_id) {
      return Response.json({ error: 'idea_id is required' }, { status: 400 });
    }

    const idea = getIdea(idea_id);
    if (!idea) {
      return Response.json({ error: 'Idea not found' }, { status: 404 });
    }

    const project = getProject(idea.project_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Default MVP pipeline stages
    const pipelineStages = stages || ['intent_analysis', 'doc_generation'];

    // Create pipeline run records for each stage
    const runs = [];
    for (const stage of pipelineStages) {
      const run = createPipelineRun(idea_id, stage, 'ai_agent');
      runs.push(run);
    }

    // Immediately trigger Stage 1: intent_analysis
    const intentRun = runs.find(r => r.stage === 'intent_analysis');
    if (intentRun) {
      try {
        updatePipelineRun(intentRun.id, {
          status: 'running',
          started_at: new Date().toISOString(),
          input_data: JSON.stringify({
            title: idea.title,
            description: idea.description,
            project_name: project.name,
            codebase_dir: project.codebase_dir,
          }),
        });

        const prompt = `你是一个资深的产品需求分析师和软件架构师。

请分析以下用户需求/反馈，判断其意图并给出结构化分析。

用户需求：
标题：${idea.title}
描述：${idea.description}

项目：${project.name}

请输出 JSON 格式分析结果：

{
  "intent_type": "bug 或 feature 或 improvement 或 unclear",
  "title": "精炼后的需求标题",
  "summary": "一句话需求摘要",
  "background": "背景分析",
  "affected_area": "受影响的功能模块",
  "complexity": "low 或 medium 或 high",
  "priority": "low 或 medium 或 high 或 urgent",
  "requires_codebase_analysis": true 或 false,
  "suggested_next_steps": ["建议的下一步操作列表"],
  "analysis_notes": "详细分析说明"
}

要求：
1. 根据描述判断需求类型
2. 给出优先级和复杂度评估
3. 判断是否需要深入代码分析
4. 只输出 JSON，不要其他内容`;

        const response = await mimo.chat.completions.create({
          model: 'mimo-v2.5-pro',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 2048,
        });

        const content = response.choices[0].message.content || '{}';
        const analysis = JSON.parse(content);

        updatePipelineRun(intentRun.id, {
          status: 'completed',
          output_data: JSON.stringify(analysis),
          completed_at: new Date().toISOString(),
        });

        // Update idea status based on analysis
        const newStatus = analysis.intent_type === 'unclear' ? 'pending' : 'analyzed';
        updateIdea(idea_id, {
          status: newStatus,
          clarification_doc: analysis.analysis_notes || analysis.summary || '',
        });
      } catch (aiError) {
        console.error('Intent analysis AI call failed:', aiError);
        updatePipelineRun(intentRun.id, {
          status: 'failed',
          error: aiError instanceof Error ? aiError.message : 'AI call failed',
          completed_at: new Date().toISOString(),
        });
      }
    }

    // Return refreshed pipeline runs
    const refreshedRuns = getPipelineRuns(idea_id);

    return Response.json({
      message: 'Pipeline started',
      idea_id,
      pipeline_runs: refreshedRuns,
    });
  } catch (error) {
    console.error('POST /api/pipeline/start error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
