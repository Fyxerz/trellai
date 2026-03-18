import { getSupabaseClient } from "@/lib/supabase/client";
import type { IChatMessageRepository, ChatMessageRow } from "../types";

function toChatMessageRow(row: Record<string, unknown>): ChatMessageRow {
  return {
    id: row.id as string,
    cardId: (row.card_id as string) ?? null,
    projectId: (row.project_id as string) ?? null,
    role: row.role as string,
    content: row.content as string,
    column: row.column as string,
    messageType: (row.message_type as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export class SupabaseChatMessageRepository implements IChatMessageRepository {
  private get client() {
    return getSupabaseClient();
  }

  async findByCardId(cardId: string): Promise<ChatMessageRow[]> {
    const { data, error } = await this.client
      .from("chat_messages")
      .select("*")
      .eq("card_id", cardId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toChatMessageRow);
  }

  async findByCardIdAndColumn(cardId: string, column: string): Promise<ChatMessageRow[]> {
    const { data, error } = await this.client
      .from("chat_messages")
      .select("*")
      .eq("card_id", cardId)
      .eq("column", column);
    if (error) throw error;
    return (data ?? []).map(toChatMessageRow);
  }

  async findByProjectId(projectId: string): Promise<ChatMessageRow[]> {
    const { data, error } = await this.client
      .from("chat_messages")
      .select("*")
      .eq("project_id", projectId)
      .is("card_id", null);
    if (error) throw error;
    return (data ?? []).map(toChatMessageRow);
  }

  async create(data: ChatMessageRow): Promise<void> {
    const { error } = await this.client.from("chat_messages").insert({
      id: data.id,
      card_id: data.cardId,
      project_id: data.projectId,
      role: data.role,
      content: data.content,
      column: data.column,
      message_type: data.messageType,
      created_at: data.createdAt,
    });
    if (error) throw error;
  }

  async deleteByCardId(cardId: string): Promise<void> {
    const { error } = await this.client
      .from("chat_messages")
      .delete()
      .eq("card_id", cardId);
    if (error) throw error;
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    const { error } = await this.client
      .from("chat_messages")
      .delete()
      .eq("project_id", projectId);
    if (error) throw error;
  }
}
