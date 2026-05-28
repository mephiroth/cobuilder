import { NextRequest } from 'next/server';
import { verifyAdmin, adminResponse } from '@/lib/auth';
import { handleGate } from '@/lib/pipeline';
import { ValidationError } from '@/lib/pipeline/errors';
import type { GateDecision, GateName } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) return adminResponse('Unauthorized');

  const { id } = await params;
  try {
    const body = await request.json();
    const result = await handleGate({
      ideaId: id,
      gate: body.gate as GateName,
      decision: body.decision as GateDecision,
      reason: body.reason,
      editedDoc: body.editedDoc,
      deferUntil: body.deferUntil,
      actorId: 'admin',
    });

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 500 });
    }
    return Response.json({ nextStatus: result.nextStatus });
  } catch (e) {
    if (e instanceof ValidationError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    console.error('POST gate error:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
