import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import type { IChatMessageRepository, ChatMessageRow } from "../types";

export class SqliteChatMessageRepository implements IChatMessageRepository {
  findByCardId(cardId: string): ChatMessageRow[] {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.cardId, cardId))
      .orderBy(asc(chatMessages.createdAt))
      .all() as ChatMessageRow[];
  }

  findByCardIdAndColumn(cardId: string, column: string): ChatMessageRow[] {
    return db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.cardId, cardId), eq(chatMessages.column, column)))
      .all() as ChatMessageRow[];
  }

  findByProjectId(projectId: string): ChatMessageRow[] {
    return db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.projectId, projectId),
          isNull(chatMessages.cardId)
        )
      )
      .all() as ChatMessageRow[];
  }

  create(data: ChatMessageRow): void {
    db.insert(chatMessages)
      .values({
        id: data.id,
        cardId: data.cardId,
        projectId: data.projectId,
        role: data.role,
        content: data.content,
        column: data.column,
        messageType: data.messageType,
        createdAt: data.createdAt,
      })
      .run();
  }

  deleteByCardId(cardId: string): void {
    db.delete(chatMessages)
      .where(eq(chatMessages.cardId, cardId))
      .run();
  }

  deleteByProjectId(projectId: string): void {
    db.delete(chatMessages)
      .where(eq(chatMessages.projectId, projectId))
      .run();
  }
}
