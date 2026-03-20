import { db } from "@/lib/db";
import { chatConversations } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { IChatConversationRepository, ChatConversationRow } from "../types";

export class SqliteChatConversationRepository implements IChatConversationRepository {
  async findByProjectId(projectId: string): Promise<ChatConversationRow[]> {
    return db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.projectId, projectId))
      .orderBy(desc(chatConversations.updatedAt))
      .all() as ChatConversationRow[];
  }

  async findById(id: string): Promise<ChatConversationRow | undefined> {
    const rows = db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.id, id))
      .all() as ChatConversationRow[];
    return rows[0];
  }

  async create(data: ChatConversationRow): Promise<void> {
    db.insert(chatConversations)
      .values({
        id: data.id,
        projectId: data.projectId,
        title: data.title,
        chatSessionId: data.chatSessionId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      })
      .run();
  }

  async update(id: string, data: Partial<Pick<ChatConversationRow, "title" | "chatSessionId" | "updatedAt">>): Promise<void> {
    db.update(chatConversations)
      .set(data)
      .where(eq(chatConversations.id, id))
      .run();
  }

  async delete(id: string): Promise<void> {
    db.delete(chatConversations)
      .where(eq(chatConversations.id, id))
      .run();
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    db.delete(chatConversations)
      .where(eq(chatConversations.projectId, projectId))
      .run();
  }
}
