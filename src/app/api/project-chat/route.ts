import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/agents/orchestrator";
import { getLocalRepositories } from "@/lib/db/repositories";
import { getAuthUser, unauthorized, assertProjectAccess } from "@/lib/auth";

const repos = getLocalRepositories();

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId required" },
      { status: 400 }
    );
  }

  const hasAccess = await assertProjectAccess(projectId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messages = await repos.chatMessages.findByProjectId(projectId);

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await req.json();
  const { action, projectId, message } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId required" },
      { status: 400 }
    );
  }

  const hasAccess = await assertProjectAccess(projectId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    switch (action) {
      case "send_message":
        await orchestrator.sendProjectMessage(projectId, message);
        return NextResponse.json({ success: true });

      case "stop":
        orchestrator.stopProjectAgent(projectId);
        return NextResponse.json({ success: true });

      case "status":
        return NextResponse.json(orchestrator.getProjectAgentStatus(projectId));

      case "clear":
        await orchestrator.clearProjectChat(projectId);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
