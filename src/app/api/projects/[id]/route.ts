import { NextRequest } from "next/server";
import { getProject, updateProject } from "@/lib/db";
import { verifyAdmin, adminResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) return adminResponse("Unauthorized");

  const { id } = await params;

  try {
    const project = getProject(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, codebase_dir, description } = body;

    if (name !== undefined && !name.trim()) {
      return Response.json({ error: "name cannot be empty" }, { status: 400 });
    }

    updateProject(id, {
      ...(name !== undefined && { name: name.trim() }),
      ...(codebase_dir !== undefined && { codebase_dir: codebase_dir.trim() }),
      ...(description !== undefined && { description: description.trim() || undefined }),
    });

    return Response.json(getProject(id));
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
