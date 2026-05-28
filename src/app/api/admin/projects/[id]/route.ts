import { NextRequest } from 'next/server';
import { verifyAdmin, adminResponse } from '@/lib/auth';
import { getProject, updateProjectExtended, countIdeasForProject } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) return adminResponse('Unauthorized');

  const { id } = await params;
  try {
    const body = await request.json();
    if (body.archived === 0 && body._delete) {
      if (countIdeasForProject(id) > 0) {
        return Response.json({ error: '项目下存在 Idea，请先归档' }, { status: 400 });
      }
    }
    updateProjectExtended(id, {
      name: body.name,
      codebase_dir: body.codebase_dir,
      description: body.description,
      enable_design_stage: body.enable_design_stage,
      archived: body.archived,
    });
    return Response.json(getProject(id));
  } catch (error) {
    console.error('PATCH /api/admin/projects/[id] error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
