import { NextRequest } from "next/server";
import { verifyAdmin, adminResponse } from "@/lib/auth";
import { listAvailableAgents, detectAgents, getAgent } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) return adminResponse("Unauthorized");

  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    if (refresh) {
      // 重置缓存，重新检测
      const { resetAgentCache } = await import("@/lib/agents/registry");
      resetAgentCache();
    }

    const all = detectAgents();
    const available = listAvailableAgents();

    return Response.json({
      total: all.length,
      available: available.length,
      agents: all.map((a) => ({
        id: a.id,
        label: a.label,
        capabilities: a.capabilities,
        available: a.available,
        version: a.version,
      })),
    });
  } catch (error) {
    console.error("GET /api/agents error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
