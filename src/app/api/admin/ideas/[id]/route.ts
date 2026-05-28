import { NextRequest } from "next/server";
import { verifyAdmin, adminResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) return adminResponse("Unauthorized");

  const { id } = await params;
  const { getIdea } = await import("@/lib/db");

  try {
    const { getPipelineState } = await import("@/lib/pipeline");
    const state = getPipelineState(id);
    if (!state) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({
      ...state.idea,
      project: state.project,
      prd: state.prd,
      uiBrief: state.uiBrief,
      devPlan: state.devPlan,
      testDoc: state.testDoc,
      lowConfidenceWarning: state.lowConfidenceWarning,
      testDocGenerationFailed: state.testDocGenerationFailed,
      recentRuns: state.recentRuns,
      usedFallback: state.usedFallback,
    });
  } catch (error) {
    console.error("GET /api/admin/ideas/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) return adminResponse("Unauthorized");

  const { id } = await params;
  const { updateIdea, getIdea } = await import("@/lib/db");

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    const idea = await getIdea(id);
    if (!idea) return Response.json({ error: "Not found" }, { status: 404 });

    if (body.description !== undefined) {
      if (!["submitted", "rejected"].includes(idea.status)) {
        return Response.json({ error: "当前状态不可修改 description" }, { status: 400 });
      }
      updates.description = body.description;
    }
    if (body.title !== undefined) updates.title = body.title;
    if (body.clarification_doc !== undefined)
      updates.clarification_doc = body.clarification_doc;
    if (body.version !== undefined) updates.version = body.version;
    if (body.visible !== undefined) updates.visible = body.visible;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No updates provided" }, { status: 400 });
    }

    await updateIdea(id, updates);
    const updated = await getIdea(id);
    return Response.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/ideas/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) return adminResponse("Unauthorized");

  const { id } = await params;
  const { deleteIdeaCascade } = await import("@/lib/db");

  try {
    deleteIdeaCascade(id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/ideas/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
