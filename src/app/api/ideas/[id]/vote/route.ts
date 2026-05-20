import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { addVote, getIdea } = await import("@/lib/db");

  try {
    const body = await request.json();
    const { voter_id } = body;

    if (!voter_id) {
      return Response.json({ error: "voter_id is required" }, { status: 400 });
    }

    const idea = await getIdea(id);
    if (!idea) {
      return Response.json({ error: "Idea not found" }, { status: 404 });
    }

    const success = await addVote(id, voter_id);
    if (!success) {
      const updated = await getIdea(id);
      return Response.json({ error: "Already voted", votes: updated?.votes || 0 }, { status: 409 });
    }

    const updated = await getIdea(id);
    return Response.json({ votes: updated?.votes || 0 });
  } catch (error) {
    console.error("POST /api/ideas/[id]/vote error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
