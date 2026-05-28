import { NextRequest } from 'next/server';
import { listProjects, createProject } from '@/lib/db';
import { verifyAdmin, adminResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { listActiveProjects } = await import('@/lib/db');
    const projects = listActiveProjects();
    return Response.json(projects);
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return adminResponse('Unauthorized');
  }

  try {
    const body = await request.json();
    const { name, codebase_dir, description } = body;

    if (!name || !codebase_dir) {
      return Response.json({ error: 'name and codebase_dir are required' }, { status: 400 });
    }

    const project = await createProject(name, codebase_dir, description);
    return Response.json(project, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
