import { NextRequest } from 'next/server';
import { verifyAdmin, adminResponse } from '@/lib/auth';
import { getIdea, getProject } from '@/lib/db';
import { generateDiff } from '@/lib/pipeline/diff';
import { getLatestStage3Run } from '@/lib/db/pipeline-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) return adminResponse('Unauthorized');

  const { id } = await params;
  const idea = getIdea(id);
  if (!idea) return Response.json({ error: 'Not found' }, { status: 404 });
  const project = getProject(idea.project_id);
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

  const { diff, fileCount, truncatedFiles } = await generateDiff(id, project.codebase_dir);
  const run = getLatestStage3Run(id);

  return Response.json({
    diff,
    fileCount,
    usedFallback: run?.used_fallback === 1,
    truncatedFiles,
  });
}
