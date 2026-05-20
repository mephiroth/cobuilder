import { NextRequest } from 'next/server';
import { verifyAdmin, adminResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return adminResponse('Unauthorized');
  }

  try {
    const {
      getIdea,
      getProject,
      getLatestPipelineRun,
      updatePipelineRun,
      createRequirementDoc,
    } = await import('@/lib/db');
    const mimo = (await import('@/lib/ai/client')).default;

    const body = await request.json();
    const { idea_id, stage } = body;

    if (!idea_id || !stage) {
      return Response.json(
        { error: 'idea_id and stage are required' },
        { status: 400 }
      );
    }

    const idea = getIdea(idea_id);
    if (!idea) {
      return Response.json({ error: 'Idea not found' }, { status: 404 });
    }

    const project = getProject(idea.project_id);

    // Validate current stage status - must be completed before advancing
    const currentRun = getLatestPipelineRun(idea_id, stage);
    if (!currentRun) {
      return Response.json(
        { error: `No pipeline run found for stage: ${stage}` },
        { status: 404 }
      );
    }

    if (currentRun.status === 'running') {
      return Response.json(
        { error: 'Current stage is still running' },
        { status: 409 }
      );
    }

    if (currentRun.status !== 'completed') {
      return Response.json(
        { error: `Current stage status is '${currentRun.status}', expected 'completed'` },
        { status: 400 }
      );
    }

    // Determine next stage and execute it
    const stageFlow: Record<string, string> = {
      intent_analysis: 'doc_generation',
    };

    const nextStage = stageFlow[stage];
    if (!nextStage) {
      return Response.json(
        { error: `No next stage defined for: ${stage}` },
        { status: 400 }
      );
    }

    // Create pipeline run for the next stage
    const { createPipelineRun } = await import('@/lib/db');
    const newRun = createPipelineRun(idea_id, nextStage, 'ai_agent');

    // Execute stage logic
    try {
      updatePipelineRun(newRun.id, {
        status: 'running',
        started_at: new Date().toISOString(),
        input_data: currentRun.output_data,
      });

      if (nextStage === 'doc_generation') {
        // Parse previous stage output for context
        let contextFromPrevStage = '';
        try {
          const prevOutput = JSON.parse(currentRun.output_data || '{}');
          contextFromPrevStage = [
            `需求类型: ${prevOutput.intent_type || 'unknown'}`,
            `摘要: ${prevOutput.summary || ''}`,
            `背景: ${prevOutput.background || ''}`,
            `受影响区域: ${prevOutput.affected_area || ''}`,
            `复杂度: ${prevOutput.complexity || 'unknown'}`,
            `优先级: ${prevOutput.priority || 'unknown'}`,
            prevOutput.analysis_notes ? `分析说明: ${prevOutput.analysis_notes}` : '',
          ]
            .filter(Boolean)
            .join('\n');
        } catch {
          contextFromPrevStage = currentRun.output_data || '';
        }

        const prompt = `你是一个资深的产品经理和技术文档专家。

基于以下需求分析结果，生成一份完整的软件需求文档（PRD）。

需求标题：${idea.title}
需求描述：${idea.description}

分析结果：
${contextFromPrevStage}

请生成需求文档，包含以下章节：

# ${idea.title}

## 1. 需求概述
简要描述需求背景和目标

## 2. 功能需求
### 2.1 用户故事
### 2.2 功能列表
### 2.3 交互流程

## 3. 非功能需求
### 3.1 性能要求
### 3.2 安全要求
### 3.3 兼容性要求

## 4. 技术方案建议
### 4.1 架构设计
### 4.2 模块划分
### 4.3 接口设计

## 5. 测试要点
### 5.1 测试场景
### 5.2 验收标准

## 6. 风险与依赖
### 6.1 技术风险
### 6.2 外部依赖

## 7. 排期建议
### 7.1 里程碑
### 7.2 预估工时

要求：
1. 文档要详细到可以直接指导开发
2. 如果能从描述中推断技术方案，给出具体建议
3. 包含明确的验收标准
4. 使用 Markdown 格式`;

        const response = await mimo.chat.completions.create({
          model: 'mimo-v2.5-pro',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 4096,
        });

        const docContent = response.choices[0].message.content || '';

        // Save requirement document
        const reqDoc = createRequirementDoc(idea_id, docContent, 'ai_agent');

        // Mark stage as completed
        updatePipelineRun(newRun.id, {
          status: 'completed',
          output_data: JSON.stringify({
            document_id: reqDoc.id,
            version: reqDoc.version,
            preview: docContent.substring(0, 200),
          }),
          completed_at: new Date().toISOString(),
        });
      } else {
        // Unknown stage - mark as failed
        updatePipelineRun(newRun.id, {
          status: 'failed',
          error: `Unknown stage logic: ${nextStage}`,
          completed_at: new Date().toISOString(),
        });
      }
    } catch (stageError) {
      console.error(`Stage ${nextStage} execution failed:`, stageError);
      updatePipelineRun(newRun.id, {
        status: 'failed',
        error: stageError instanceof Error ? stageError.message : 'Stage execution failed',
        completed_at: new Date().toISOString(),
      });
    }

    // Return updated state
    const { getPipelineRuns, getRequirementDocs } = await import('@/lib/db');
    const allRuns = getPipelineRuns(idea_id);
    const allDocs = getRequirementDocs(idea_id);

    return Response.json({
      message: `Advanced from ${stage} to ${nextStage}`,
      idea_id,
      pipeline_runs: allRuns,
      requirement_docs: allDocs,
    });
  } catch (error) {
    console.error('POST /api/pipeline/advance error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
