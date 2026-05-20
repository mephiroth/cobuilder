import { NextRequest } from "next/server";
import { verifyAdmin, adminResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) return adminResponse("Unauthorized");

  const { getStats } = await import("@/lib/db");
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id") || undefined;

  try {
    const stats = await getStats(projectId);
    return Response.json(stats);
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
