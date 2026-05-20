import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { listComments } = await import("@/lib/db");

  try {
    const comments = await listComments(id);
    return Response.json(comments);
  } catch (error) {
    console.error("GET /api/ideas/[id]/comments error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { addComment, getIdea } = await import("@/lib/db");

  try {
    const body = await request.json();
    const { author_name, content } = body;

    if (!content?.trim()) {
      return Response.json({ error: "content is required" }, { status: 400 });
    }

    const idea = await getIdea(id);
    if (!idea) {
      return Response.json({ error: "Idea not found" }, { status: 404 });
    }

    const comment = await addComment(id, author_name || "匿名", content.trim(), false);
    return Response.json(comment, { status: 201 });
  } catch (error) {
    console.error("POST /api/ideas/[id]/comments error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
