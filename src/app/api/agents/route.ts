import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/agents/orchestrator";
import { getLocalRepositories } from "@/lib/db/repositories";
import { getOptionalUser, assertCardAccessForUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import { submitAnswer, getPendingQuestionForCard } from "@/lib/agents/question-queue";

const repos = getLocalRepositories();

export async function POST(req: NextRequest) {
  const user = await getOptionalUser();

  const body = await req.json();
  const { action, cardId, message } = body;

  try {
    // Verify card access for actions that need a cardId
    if (cardId) {
      const hasAccess = await assertCardAccessForUser(cardId, user);
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Card not found. It may have been deleted." },
          { status: 404 }
        );
      }
    }

    // Validate card exists for actions that need it
    if (cardId && ["send_message", "save_message"].includes(action)) {
      const card = await repos.cards.findById(cardId);
      if (!card) {
        return NextResponse.json(
          { error: "Card not found. It may have been deleted." },
          { status: 404 }
        );
      }
    }

    switch (action) {
      case "send_message": {
        // Persist the user message immediately before calling the orchestrator.
        const card = await repos.cards.findById(cardId);
        await repos.chatMessages.create({
          id: uuid(),
          cardId,
          projectId: null,
          role: "user",
          content: message,
          column: card?.column || "production",
          messageType: null,
          createdAt: new Date().toISOString(),
        });

        // Auto-move backlog → planning when sending a message
        if (card && card.column === "features") {
          await repos.cards.update(cardId, { column: "planning", updatedAt: new Date().toISOString() });
          const { emitToCard } = await import("@/lib/socket");
          emitToCard(cardId, "card:auto-move", { cardId, column: "planning" });
        }

        await orchestrator.sendMessage(cardId, message);
        return NextResponse.json({ success: true });
      }

      case "stop":
        orchestrator.stopAgent(cardId);
        return NextResponse.json({ success: true });

      case "save_message":
        await repos.chatMessages.create({
          id: uuid(),
          cardId,
          projectId: null,
          role: "user",
          content: message,
          column: body.column || "features",
          messageType: null,
          createdAt: new Date().toISOString(),
        });
        return NextResponse.json({ success: true });

      case "confirm_move_to_dev":
        await orchestrator.confirmMoveToDev(cardId);
        return NextResponse.json({ success: true });

      case "answer_question": {
        const { questionId, answer, question: questionText } = body;
        if (!questionId || !answer) {
          return NextResponse.json(
            { error: "questionId and answer are required" },
            { status: 400 }
          );
        }

        // Persist the question and answer as a single combined Q&A message
        const card2 = await repos.cards.findById(cardId);
        const col = card2?.column || "features";

        await repos.chatMessages.create({
          id: uuid(),
          cardId,
          projectId: null,
          role: "assistant",
          content: `{{qa:${questionText || "Unknown question"}||${answer}}}`,
          column: col,
          messageType: null,
          createdAt: new Date().toISOString(),
        });

        const submitted = submitAnswer(questionId, answer);
        return NextResponse.json({ success: true, submitted });
      }

      case "pending_question": {
        if (!cardId) {
          return NextResponse.json(
            { error: "cardId required" },
            { status: 400 }
          );
        }
        const pq = getPendingQuestionForCard(cardId);
        return NextResponse.json({ pendingQuestion: pq });
      }

      case "streaming_state":
        return NextResponse.json(orchestrator.getStreamingState(cardId));

      case "status":
        return NextResponse.json(await orchestrator.getAgentStatus(cardId));

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

export async function GET(req: NextRequest) {
  const user = await getOptionalUser();

  const cardId = req.nextUrl.searchParams.get("cardId");
  if (!cardId) {
    return NextResponse.json(
      { error: "cardId required" },
      { status: 400 }
    );
  }

  const hasAccess = await assertCardAccessForUser(cardId, user);
  if (!hasAccess) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const messages = await repos.chatMessages.findByCardId(cardId);

  return NextResponse.json(messages);
}
