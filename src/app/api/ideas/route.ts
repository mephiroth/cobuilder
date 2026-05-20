import { NextRequest } from "next/server";
import { listIdeas, countComments } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id") || undefined;
  const status = searchParams.get("status") || undefined;

  try {
    const ideas = listIdeas({
      project_id: projectId,
      status,
      visible: true,
    });

    // Attach comment counts
    const ideasWithCounts = ideas.map((idea) => ({
      ...idea,
      comment_count: countComments(idea.id),
    }));

    return Response.json(ideasWithCounts);
  } catch (error) {
    console.error("GET /api/ideas error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
