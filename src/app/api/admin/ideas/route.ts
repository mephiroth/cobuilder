import { NextRequest } from "next/server";
import { verifyAdmin, adminResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) return adminResponse("Unauthorized");

  const { listIdeas } = await import("@/lib/db");
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;

  try {
    const ideas = await listIdeas({
      status,
      // No visible filter - admin sees all
    });
    return Response.json(ideas);
  } catch (error) {
    console.error("GET /api/admin/ideas error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
