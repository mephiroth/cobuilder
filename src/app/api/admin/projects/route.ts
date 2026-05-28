import { NextRequest } from 'next/server';
import { verifyAdmin, adminResponse } from '@/lib/auth';
import { createProject } from '@/lib/db';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) return adminResponse('Unauthorized');

  try {
    const body = await request.json();
    const { name, codebase_dir, description, enable_design_stage } = body;

    if (!name || name.length < 1 || name.length > 50) {
      return Response.json({ error: 'name 须 1-50 字符' }, { status: 400 });
    }
    if (!codebase_dir || !path.isAbsolute(codebase_dir)) {
      return Response.json({ error: 'codebase_dir 必须为绝对路径' }, { status: 400 });
    }

    const project = createProject(name, codebase_dir, description);
    if (enable_design_stage) {
      const { updateProjectExtended } = await import('@/lib/db');
      updateProjectExtended(project.id, { enable_design_stage: 1 });
    }
    return Response.json(project, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/projects error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
