import { NextRequest } from 'next/server';
import { getStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const stats = await getStats(id);
    return Response.json(stats);
  } catch (error) {
    console.error('GET /api/projects/[id]/stats error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
