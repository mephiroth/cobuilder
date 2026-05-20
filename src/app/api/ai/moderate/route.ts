import { NextRequest } from 'next/server';
import { moderateContent } from '@/lib/ai/moderator';
import { verifyAdmin, adminResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return adminResponse('Unauthorized');
  }

  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return Response.json({ error: 'text is required' }, { status: 400 });
    }

    const result = await moderateContent(text);
    return Response.json(result);
  } catch (error) {
    console.error('POST /api/ai/moderate error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
