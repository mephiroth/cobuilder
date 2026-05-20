import { NextRequest } from 'next/server';
import { getIdea, updateIdea, createNotification } from '@/lib/db';
import { verifyAdmin, adminResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['pending', 'clarified', 'in_progress', 'published', 'deferred', 'closed'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) {
    return adminResponse('Unauthorized');
  }

  try {
    const { id } = await params;
    const idea = await getIdea(id);

    if (!idea) {
      return Response.json({ error: 'Idea not found' }, { status: 404 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return Response.json({ error: 'status is required' }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return Response.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    await updateIdea(id, { status });

    // If published and idea has a client_id, create notification
    if (status === 'published' && idea.client_id) {
      await createNotification(id, idea.client_id, 'published');
    }

    const updatedIdea = await getIdea(id);
    return Response.json(updatedIdea);
  } catch (error) {
    console.error('POST /api/admin/ideas/[id]/status error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
