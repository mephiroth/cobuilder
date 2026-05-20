import { NextRequest } from 'next/server';
import { verifyAdmin, adminResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ideaId: string }> }
) {
  if (!verifyAdmin(request)) {
    return adminResponse('Unauthorized');
  }

  try {
    const { getPipelineRuns, getRequirementDocs, getIdea } = await import('@/lib/db');
    const { ideaId } = await params;

    if (!ideaId) {
      return Response.json({ error: 'ideaId is required' }, { status: 400 });
    }

    const idea = getIdea(ideaId);
    if (!idea) {
      return Response.json({ error: 'Idea not found' }, { status: 404 });
    }

    const runs = getPipelineRuns(ideaId);
    const docs = getRequirementDocs(ideaId);

    return Response.json({
      idea,
      pipeline_runs: runs,
      requirement_docs: docs,
    });
  } catch (error) {
    console.error('GET /api/pipeline/[ideaId] error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
