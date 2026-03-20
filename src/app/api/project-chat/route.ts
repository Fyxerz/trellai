import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/agents/orchestrator";
import { getLocalRepositories } from "@/lib/db/repositories";
import { getOptionalUser, assertProjectAccessForUser } from "@/lib/auth";

const repos = getLocalRepositories();

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId required" },
      { status: 400 }
    );
  }

  const hasAccess = await assertProjectAccessForUser(projectId, user);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId");

  if (conversationId) {
    // Fetch messages for a specific conversation
    const messages = await repos.chatMessages.findByConversationId(conversationId);
    return NextResponse.json(messages);
  }

  // Legacy: fetch all project messages (no conversation filter)
  const messages = await repos.chatMessages.findByProjectId(projectId);
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const user = await getOptionalUser();

  const body = await req.json();
  const { action, projectId, message, conversationId } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId required" },
      { status: 400 }
    );
  }

  const hasAccess = await assertProjectAccessForUser(projectId, user);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    switch (action) {
      case "send_message": {
        const result = await orchestrator.sendProjectMessage(projectId, message, conversationId);
        return NextResponse.json({ success: true, conversationId: result.conversationId });
      }

      case "stop":
        orchestrator.stopProjectAgent(projectId);
        return NextResponse.json({ success: true });

      case "status":
        return NextResponse.json(orchestrator.getProjectAgentStatus(projectId));

      case "clear":
        await orchestrator.clearProjectChat(projectId);
        return NextResponse.json({ success: true });

      case "list_conversations": {
        const conversations = await repos.chatConversations.findByProjectId(projectId);
        return NextResponse.json(conversations);
      }

      case "delete_conversation": {
        if (!conversationId) {
          return NextResponse.json({ error: "conversationId required" }, { status: 400 });
        }
        await orchestrator.deleteConversation(projectId, conversationId);
        return NextResponse.json({ success: true });
      }

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
