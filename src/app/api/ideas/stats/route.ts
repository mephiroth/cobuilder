import { NextRequest } from "next/server";
import { getStats } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id") || undefined;

  try {
    const stats = await getStats(projectId);

    // Transform to status -> count map
    const counts: Record<string, number> = {};
    if (stats) {
      counts.pending = Number(stats.pending_count || 0);
      counts.clarified = Number(stats.clarified_count || 0);
      counts.in_progress = Number(stats.in_progress_count || 0);
      counts.published = Number(stats.published_count || 0);
      counts.deferred = Number(stats.deferred_count || 0);
      counts.closed = Number(stats.closed_count || 0);
    }

    return Response.json(counts);
  } catch (error) {
    console.error("GET /api/ideas/stats error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
