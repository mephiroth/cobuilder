import { NextRequest } from "next/server";
import { detectAgents, resetAgentCache } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("refresh") === "true") {
      resetAgentCache();
    }

    const agents = detectAgents();
    const detectedAt = new Date().toISOString();

    return Response.json(
      agents.map((a) => ({
        id: a.id,
        label: a.label,
        available: a.available,
        version: a.version ?? null,
        detected_at: detectedAt,
      }))
    );
  } catch (error) {
    console.error("GET /api/agents error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
