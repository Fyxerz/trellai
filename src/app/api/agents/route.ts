import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/agents/orchestrator";
import { db } from "@/lib/db";
import { cards, chatMessages } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { submitAnswer, getPendingQuestionForCard } from "@/lib/agents/question-queue";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, cardId, message } = body;

  try {
    // Validate card exists for actions that need it
    if (cardId && ["send_message", "save_message"].includes(action)) {
      const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
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
        // Previously, the save lived inside orchestrator.sendMessage() and could
        // be skipped if any earlier check (card/project lookup) threw.
        const card = db.select().from(cards).where(eq(cards.id, cardId)).get();
        db.insert(chatMessages)
          .values({
            id: uuid(),
            cardId,
            role: "user",
            content: message,
            column: card?.column || "production",
            createdAt: new Date().toISOString(),
          })
          .run();
        await orchestrator.sendMessage(cardId, message);
        return NextResponse.json({ success: true });
      }

      case "stop":
        orchestrator.stopAgent(cardId);
        return NextResponse.json({ success: true });

      case "save_message":
        db.insert(chatMessages)
          .values({
            id: uuid(),
            cardId,
            role: "user",
            content: message,
            column: body.column || "features",
            createdAt: new Date().toISOString(),
          })
          .run();
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

        // Persist the question and answer as chat messages for history
        const card2 = db.select().from(cards).where(eq(cards.id, cardId)).get();
        const col = card2?.column || "features";
        const now = new Date().toISOString();

        if (questionText) {
          db.insert(chatMessages)
            .values({
              id: uuid(),
              cardId,
              role: "assistant",
              content: `**Question:** ${questionText}`,
              column: col,
              createdAt: now,
            })
            .run();
        }

        db.insert(chatMessages)
          .values({
            id: uuid(),
            cardId,
            role: "user",
            content: answer,
            column: col,
            createdAt: new Date().toISOString(),
          })
          .run();

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

      case "status":
        return NextResponse.json(orchestrator.getAgentStatus(cardId));

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
  const cardId = req.nextUrl.searchParams.get("cardId");
  if (!cardId) {
    return NextResponse.json(
      { error: "cardId required" },
      { status: 400 }
    );
  }

  const messages = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.cardId, cardId))
    .orderBy(asc(chatMessages.createdAt))
    .all();

  return NextResponse.json(messages);
}
