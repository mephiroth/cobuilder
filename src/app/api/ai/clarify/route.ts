import { NextRequest } from 'next/server';
import { getIdea, getProject, updateIdea } from '@/lib/db';
import { scanCodebase, formatContext } from '@/lib/ai/scanner';
import { clarifyIdea } from '@/lib/ai/clarifier';
import { verifyAdmin, adminResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return adminResponse('Unauthorized');
  }

  try {
    const body = await request.json();
    const { idea_id } = body;

    if (!idea_id) {
      return Response.json({ error: 'idea_id is required' }, { status: 400 });
    }

    const idea = await getIdea(idea_id);
    if (!idea) {
      return Response.json({ error: 'Idea not found' }, { status: 404 });
    }

    const project = await getProject(idea.project_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Scan codebase for relevant context
    let codebaseContext = '';
    if (project.codebase_dir) {
      try {
        const contexts = scanCodebase(project.codebase_dir, idea.description);
        codebaseContext = formatContext(contexts);
      } catch (err) {
        console.warn('Codebase scan failed, proceeding without context:', err);
      }
    }

    // Call AI clarify
    const result = await clarifyIdea(
      { title: idea.title, description: idea.description },
      codebaseContext || undefined
    );

    // Update idea with clarification
    await updateIdea(idea_id, {
      clarification_doc: result.clarification_md,
      status: 'clarified',
    });

    return Response.json(result);
  } catch (error) {
    console.error('POST /api/ai/clarify error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
