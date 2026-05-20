import { NextRequest } from "next/server";
import { verifyAdmin, adminResponse } from "@/lib/auth";
import { deleteComment } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAdmin(request)) return adminResponse("Unauthorized");

  const { id } = await params;

  try {
    deleteComment(id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/comments/[id] error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
