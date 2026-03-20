import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { IBoardCollaboratorRepository, BoardCollaboratorRow } from "../types";

function toBoardCollaboratorRow(row: Record<string, unknown>): BoardCollaboratorRow {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    userId: row.user_id as string,
    role: row.role as BoardCollaboratorRow["role"],
    createdAt: row.created_at as string,
  };
}

export class SupabaseBoardCollaboratorRepository implements IBoardCollaboratorRepository {
  private _client: SupabaseClient | null;

  constructor(client?: SupabaseClient) {
    this._client = client ?? null;
  }

  private get client() {
    return this._client ?? getSupabaseClient();
  }

  async findByProjectId(projectId: string): Promise<BoardCollaboratorRow[]> {
    const { data, error } = await this.client
      .from("board_collaborators")
      .select("*")
      .eq("project_id", projectId);
    if (error) throw error;
    return (data ?? []).map(toBoardCollaboratorRow);
  }

  async findByUserId(userId: string): Promise<BoardCollaboratorRow[]> {
    const { data, error } = await this.client
      .from("board_collaborators")
      .select("*")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map(toBoardCollaboratorRow);
  }

  async findByProjectAndUser(projectId: string, userId: string): Promise<BoardCollaboratorRow | undefined> {
    const { data, error } = await this.client
      .from("board_collaborators")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? toBoardCollaboratorRow(data) : undefined;
  }

  async findById(id: string): Promise<BoardCollaboratorRow | undefined> {
    const { data, error } = await this.client
      .from("board_collaborators")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toBoardCollaboratorRow(data) : undefined;
  }

  async create(data: Omit<BoardCollaboratorRow, "id" | "createdAt"> & { id?: string }): Promise<BoardCollaboratorRow> {
    const insertData: Record<string, unknown> = {
      project_id: data.projectId,
      user_id: data.userId,
      role: data.role,
    };
    if (data.id) insertData.id = data.id;

    const { data: result, error } = await this.client
      .from("board_collaborators")
      .insert(insertData)
      .select()
      .single();
    if (error) throw error;
    return toBoardCollaboratorRow(result);
  }

  async update(id: string, data: Partial<Pick<BoardCollaboratorRow, "role">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.role !== undefined) updateData.role = data.role;
    if (Object.keys(updateData).length > 0) {
      const { error } = await this.client.from("board_collaborators").update(updateData).eq("id", id);
      if (error) throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("board_collaborators").delete().eq("id", id);
    if (error) throw error;
  }
}
