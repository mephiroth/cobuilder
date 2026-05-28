import { NextRequest } from 'next/server';
import { listNotifications } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const client_id = searchParams.get('client_id');

    if (!client_id) {
      return Response.json({ error: 'client_id query parameter is required' }, { status: 400 });
    }

    const unreadOnly = searchParams.get('unread_only') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const notifications = listNotifications(client_id, { unreadOnly, limit, offset });
    return Response.json(notifications);
  } catch (error) {
    console.error('GET /api/notifications error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
