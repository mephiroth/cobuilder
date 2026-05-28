import { NextRequest } from "next/server";
import {
  listIdeas,
  countComments,
  createIdea,
  getDefaultActiveProject,
  getProject,
  createNotification,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const HIDDEN_STATUSES = ["submitted", "rejected", "deferred"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id") || undefined;

  try {
    const ideas = listIdeas({
      project_id: projectId,
      visible: true,
    }).filter((idea) => !HIDDEN_STATUSES.includes(idea.status));

    const ideasWithCounts = ideas.map((idea) => ({
      ...idea,
      comment_count: countComments(idea.id),
    }));

    return Response.json(ideasWithCounts);
  } catch (error) {
    console.error("GET /api/ideas error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      project_id,
      author_name,
      author_contact,
      client_id,
      screenshots,
    } = body;

    if (!title?.trim() || title.length > 100) {
      return Response.json({ error: "title 须 1-100 字符" }, { status: 400 });
    }
    if (!description?.trim() || description.length < 10) {
      return Response.json(
        { error: "描述过短，请补充更多信息" },
        { status: 400 }
      );
    }
    if (description.length > 2000) {
      return Response.json({ error: "description 最多 2000 字符" }, { status: 400 });
    }

    let projectId = project_id;
    if (!projectId) {
      const def = getDefaultActiveProject();
      if (!def) {
        return Response.json({ error: "暂无可用项目" }, { status: 400 });
      }
      projectId = def.id;
    }

    const project = getProject(projectId);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.archived) {
      return Response.json({ error: "项目已归档" }, { status: 400 });
    }

    const idea = createIdea({
      project_id: projectId,
      title: title.trim(),
      description: description.trim(),
      author_name: author_name?.trim() || "匿名",
      author_contact: author_contact?.trim(),
      client_id: client_id?.trim(),
      screenshots: screenshots ? JSON.stringify(screenshots) : "[]",
    });

    createNotification(idea.id, "admin", "submitted");

    return Response.json(idea, { status: 201 });
  } catch (error) {
    console.error("POST /api/ideas error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
