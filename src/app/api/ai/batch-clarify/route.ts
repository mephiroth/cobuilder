import { NextRequest } from 'next/server';
import { listIdeas, getProject, updateIdea } from '@/lib/db';
import { scanCodebase, formatContext } from '@/lib/ai/scanner';
import { clarifyIdea } from '@/lib/ai/clarifier';
import { verifyAdmin, adminResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const CONCURRENCY_LIMIT = 3;

async function clarifyOne(
  idea: { id: string; title: string; description: string },
  codebaseDir: string
): Promise<{ id: string; success: boolean; error?: string }> {
  try {
    let codebaseContext = '';
    if (codebaseDir) {
      try {
        const contexts = scanCodebase(codebaseDir, idea.description);
        codebaseContext = formatContext(contexts);
      } catch {
        // Proceed without context
      }
    }

    const result = await clarifyIdea(
      { title: idea.title, description: idea.description },
      codebaseContext || undefined
    );

    await updateIdea(idea.id, {
      clarification_doc: result.clarification_md,
      status: 'clarified',
    });

    return { id: idea.id, success: true };
  } catch (error) {
    return { id: idea.id, success: false, error: String(error) };
  }
}

async function processBatch<T>(
  items: T[],
  fn: (item: T) => Promise<unknown>,
  concurrency: number
): Promise<unknown[]> {
  const results: unknown[] = [];
  const queue = [...items];

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift()!;
      results.push(await fn(item));
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return adminResponse('Unauthorized');
  }

  try {
    const body = await request.json();
    const { project_id } = body;

    if (!project_id) {
      return Response.json({ error: 'project_id is required' }, { status: 400 });
    }

    const project = await getProject(project_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const pendingIdeas = await listIdeas({
      project_id,
      status: 'pending',
      visible: undefined,
    });

    if (pendingIdeas.length === 0) {
      return Response.json({ message: 'No pending ideas to clarify', processed: 0 });
    }

    const results = await processBatch(
      pendingIdeas.map((idea) => ({
        id: idea.id,
        title: idea.title,
        description: idea.description,
      })),
      (item: { id: string; title: string; description: string }) =>
        clarifyOne(item, project.codebase_dir),
      CONCURRENCY_LIMIT
    );

    const succeeded = results.filter((r: any) => r.success).length;
    const failed = results.filter((r: any) => !r.success).length;

    return Response.json({
      message: `Batch clarify complete: ${succeeded} succeeded, ${failed} failed`,
      total: pendingIdeas.length,
      succeeded,
      failed,
      results,
    });
  } catch (error) {
    console.error('POST /api/ai/batch-clarify error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
