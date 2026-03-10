import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/agents/orchestrator";
import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId required" },
      { status: 400 }
    );
  }

  const messages = db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.projectId, projectId),
        isNull(chatMessages.cardId)
      )
    )
    .all();

  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, projectId, message } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId required" },
      { status: 400 }
    );
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
