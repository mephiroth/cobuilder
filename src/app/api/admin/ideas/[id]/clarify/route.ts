import { NextRequest } from "next/server";
import { verifyAdmin, adminResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) return adminResponse("Unauthorized");

  const { id } = await params;
  const { getIdea, updateIdea } = await import("@/lib/db");
  const { clarifyIdea } = await import("@/lib/ai/clarifier");
  const { scanCodebase, formatContext } = await import("@/lib/ai/scanner");

  try {
    const idea = await getIdea(id);
    if (!idea) {
      return Response.json({ error: "Idea not found" }, { status: 404 });
    }

    const { getProject } = await import("@/lib/db");
    const project = await getProject(idea.project_id);

    let codebaseContext: string | undefined;
    if (project?.codebase_dir) {
      const contexts = scanCodebase(project.codebase_dir, idea.description);
      codebaseContext = formatContext(contexts) || undefined;
    }

    const result = await clarifyIdea(
      { title: idea.title, description: idea.description },
      codebaseContext
    );

    await updateIdea(id, {
      clarification_doc: result.clarification_md,
      status: "clarified",
    } as any);

    return Response.json(result);
  } catch (error) {
    console.error("POST /api/admin/ideas/[id]/clarify error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "AI clarify failed" },
      { status: 500 }
    );
  }
}
