import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { getIdea } = await import("@/lib/db");

  try {
    const idea = await getIdea(id);
    if (!idea) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(idea);
  } catch (error) {
    console.error("GET /api/ideas/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
