import { NextRequest } from 'next/server';
import { verifyAdmin, adminResponse } from '@/lib/auth';
import { getProject, updateProjectExtended, countIdeasForProject } from '@/lib/db';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) return adminResponse('Unauthorized');

  const { id } = await params;
  try {
    const body = await request.json();
    // Call getProject first to ensure the DB is initialized (which also wires pipeline-db)
    const existing = getProject(id);
    if (!existing) {
      return Response.json({ error: '项目不存在' }, { status: 404 });
    }
    if (body.archived === 0 && body._delete) {
      if (countIdeasForProject(id) > 0) {
        return Response.json({ error: '项目下存在 Idea，请先归档' }, { status: 400 });
      }
    }
    if (body.name !== undefined && (body.name.length < 1 || body.name.length > 50)) {
      return Response.json({ error: 'name 须 1-50 字符' }, { status: 400 });
    }
    if (body.codebase_dir !== undefined && !path.isAbsolute(body.codebase_dir)) {
      return Response.json({ error: 'codebase_dir 必须为绝对路径' }, { status: 400 });
    }
    updateProjectExtended(id, {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.codebase_dir !== undefined && { codebase_dir: body.codebase_dir }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.enable_design_stage !== undefined && { enable_design_stage: body.enable_design_stage }),
      ...(body.archived !== undefined && { archived: body.archived }),
    });
    return Response.json(getProject(id));
  } catch (error) {
    console.error('PATCH /api/admin/projects/[id] error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
