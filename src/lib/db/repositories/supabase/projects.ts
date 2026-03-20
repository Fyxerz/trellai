import { getSupabaseClient } from "@/lib/supabase/client";
import type { IProjectRepository, ProjectRow } from "../types";

/** Map a Supabase snake_case row to our camelCase ProjectRow */
function toProjectRow(row: Record<string, unknown>): ProjectRow {
  return {
    id: row.id as string,
    name: row.name as string,
    repoPath: row.repo_path as string,
    chatSessionId: (row.chat_session_id as string) ?? null,
    mode: row.mode as string,
    storageMode: row.storage_mode as string,
    userId: (row.user_id as string) ?? null,
    teamId: (row.team_id as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export class SupabaseProjectRepository implements IProjectRepository {
  private get client() {
    return getSupabaseClient();
  }

  async findAll(): Promise<ProjectRow[]> {
    const { data, error } = await this.client
      .from("projects")
      .select("*");
    if (error) throw error;
    return (data ?? []).map(toProjectRow);
  }

  async findById(id: string): Promise<ProjectRow | undefined> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toProjectRow(data) : undefined;
  }

  async findByTeamId(teamId: string): Promise<ProjectRow[]> {
    const { data, error } = await this.client
      .from("projects")
      .select("*")
      .eq("team_id", teamId);
    if (error) throw error;
    return (data ?? []).map(toProjectRow);
  }

  async create(data: Omit<ProjectRow, "chatSessionId" | "storageMode" | "userId" | "teamId"> & { storageMode?: string; userId?: string | null; teamId?: string | null }): Promise<void> {
    const { error } = await this.client.from("projects").insert({
      id: data.id,
      name: data.name,
      repo_path: data.repoPath,
      mode: data.mode,
      storage_mode: data.storageMode || "supabase",
      user_id: data.userId ?? null,
      team_id: data.teamId ?? null,
      created_at: data.createdAt,
    });
    if (error) throw error;
  }

  async update(id: string, data: Partial<Pick<ProjectRow, "name" | "mode" | "chatSessionId" | "storageMode" | "teamId">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.mode !== undefined) updateData.mode = data.mode;
    if (data.chatSessionId !== undefined) updateData.chat_session_id = data.chatSessionId;
    if (data.storageMode !== undefined) updateData.storage_mode = data.storageMode;
    if (data.teamId !== undefined) updateData.team_id = data.teamId;
    if (Object.keys(updateData).length > 0) {
      const { error } = await this.client.from("projects").update(updateData).eq("id", id);
      if (error) throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("projects").delete().eq("id", id);
    if (error) throw error;
  }
}
