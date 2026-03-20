import { getSupabaseClient } from "@/lib/supabase/client";
import type { IChatConversationRepository, ChatConversationRow } from "../types";

function toChatConversationRow(row: Record<string, unknown>): ChatConversationRow {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    chatSessionId: (row.chat_session_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class SupabaseChatConversationRepository implements IChatConversationRepository {
  private get client() {
    return getSupabaseClient();
  }

  async findByProjectId(projectId: string): Promise<ChatConversationRow[]> {
    const { data, error } = await this.client
      .from("chat_conversations")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toChatConversationRow);
  }

  async findById(id: string): Promise<ChatConversationRow | undefined> {
    const { data, error } = await this.client
      .from("chat_conversations")
      .select("*")
      .eq("id", id)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? toChatConversationRow(data) : undefined;
  }

  async create(data: ChatConversationRow): Promise<void> {
    const { error } = await this.client.from("chat_conversations").insert({
      id: data.id,
      project_id: data.projectId,
      title: data.title,
      chat_session_id: data.chatSessionId,
      created_at: data.createdAt,
      updated_at: data.updatedAt,
    });
    if (error) throw error;
  }

  async update(id: string, data: Partial<Pick<ChatConversationRow, "title" | "chatSessionId" | "updatedAt">>): Promise<void> {
    const mapped: Record<string, unknown> = {};
    if (data.title !== undefined) mapped.title = data.title;
    if (data.chatSessionId !== undefined) mapped.chat_session_id = data.chatSessionId;
    if (data.updatedAt !== undefined) mapped.updated_at = data.updatedAt;
    const { error } = await this.client
      .from("chat_conversations")
      .update(mapped)
      .eq("id", id);
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from("chat_conversations")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    const { error } = await this.client
      .from("chat_conversations")
      .delete()
      .eq("project_id", projectId);
    if (error) throw error;
  }
}
