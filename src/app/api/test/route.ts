import { NextResponse } from 'next/server';
import { verifyAdmin, adminResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!verifyAdmin(request)) {
    return adminResponse('Unauthorized');
  }

  try {
    const { listProjects } = await import('@/lib/db');
    const projects = listProjects();
    return NextResponse.json({ ok: true, count: projects.length, projects });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}
