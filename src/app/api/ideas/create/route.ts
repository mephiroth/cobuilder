import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { createIdea, getProject } = await import("@/lib/db");

  try {
    const body = await request.json();
    const { project_id, title, description, author_name, author_contact } = body;

    if (!project_id || !title?.trim() || !description?.trim()) {
      return Response.json(
        { error: "project_id, title, and description are required" },
        { status: 400 }
      );
    }

    const project = await getProject(project_id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const idea = await createIdea({
      project_id,
      title: title.trim(),
      description: description.trim(),
      author_name: author_name?.trim() || undefined,
      author_contact: author_contact?.trim() || undefined,
    });

    return Response.json(idea, { status: 201 });
  } catch (error) {
    console.error("POST /api/ideas error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
