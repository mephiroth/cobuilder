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

  const { createIdea } = await import("@/lib/db");

  try {
    const body = await request.json();
    const { title, description, author_name, project_id } = body;

    if (!project_id?.trim()) {
      return Response.json(
        { error: "project_id 为必填项" },
        { status: 400 }
      );
    }

    if (!title?.trim() || !description?.trim()) {
      return Response.json(
        { error: "title and description are required" },
        { status: 400 }
      );
    }

    const idea = createIdea({
      project_id: project_id.trim(),
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
