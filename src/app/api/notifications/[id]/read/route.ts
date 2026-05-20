import { NextRequest } from 'next/server';
import { markNotificationRead } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await markNotificationRead(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('POST /api/notifications/[id]/read error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
