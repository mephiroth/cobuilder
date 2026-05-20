import { NextRequest } from 'next/server';
import { listIdeas, createIdea, getProject, updateIdea } from '@/lib/db';
import { moderateContent } from '@/lib/ai/moderator';
import { verifyAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    const isAdmin = verifyAdmin(request);

    const ideas = await listIdeas({
      project_id: id,
      status,
      visible: isAdmin ? undefined : true,
      limit,
      offset,
    });

    return Response.json(ideas);
  } catch (error) {
    console.error('GET /api/projects/[id]/ideas error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, author_name, author_contact, client_id, screenshots, source } = body;

    if (!title || !description) {
      return Response.json({ error: 'title and description are required' }, { status: 400 });
    }

    const idea = await createIdea({
      project_id: id,
      title,
      description,
      author_name,
      author_contact,
      client_id,
      screenshots,
      source,
    });

    // Async moderation — fire and forget
    moderateContent(description).then((result) => {
      if (!result.approved) {
        updateIdea(idea.id, { moderation_status: 'rejected', visible: 0 });
      } else {
        updateIdea(idea.id, { moderation_status: 'approved', visible: 1 });
      }
    }).catch((err: Error) => {
      console.error('Moderation error:', err);
    });

    return Response.json(idea, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/ideas error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
