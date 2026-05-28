import { NextRequest } from 'next/server';
import { verifyAdmin, adminResponse } from '@/lib/auth';
import { startPipeline, rejectAtSubmission, retryDev } from '@/lib/pipeline';
import { ValidationError, TooManyRetriesError } from '@/lib/pipeline/errors';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) return adminResponse('Unauthorized');

  const { id } = await params;
  try {
    const body = await request.json();
    const action = body.action ?? 'start';

    if (action === 'start') {
      const result = await startPipeline(id, 'admin');
      return Response.json(result);
    }
    if (action === 'reject') {
      const reason = body.reason ?? '';
      await rejectAtSubmission(id, 'admin', reason);
      return Response.json({ status: 'rejected' });
    }
    if (action === 'retry_dev') {
      await retryDev(id, 'admin');
      return Response.json({ status: 'dev_pending' });
    }

    return Response.json({ error: '未知 action' }, { status: 400 });
  } catch (e) {
    if (e instanceof ValidationError || e instanceof TooManyRetriesError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    console.error('POST pipeline error:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
