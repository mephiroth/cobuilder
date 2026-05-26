import { NextRequest } from "next/server";
import { verifyAdmin, adminResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) return adminResponse("Unauthorized");

  const { listIdeas } = await import("@/lib/db");
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;

  try {
    const ideas = await listIdeas({
      status,
      // No visible filter - admin sees all
    });
    return Response.json(ideas);
  } catch (error) {
    console.error("GET /api/admin/ideas error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) return adminResponse("Unauthorized");

  const { createIdea, listProjects } = await import("@/lib/db");

  try {
    const body = await request.json();
    const { title, description, author_name, project_id } = body;

    if (!title?.trim() || !description?.trim()) {
      return Response.json(
        { error: "title and description are required" },
        { status: 400 }
      );
    }

    // Use provided project_id or fall back to first project
    let targetProjectId = project_id;
    if (!targetProjectId) {
      const projects = listProjects();
      if (projects.length === 0) {
        return Response.json({ error: "No projects found" }, { status: 404 });
      }
      targetProjectId = projects[0].id;
    }

    const idea = createIdea({
      project_id: targetProjectId,
      title: title.trim(),
      description: description.trim(),
      author_name: author_name?.trim() || "管理员",
      source: "admin",
    });

    return Response.json(idea, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/ideas error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
