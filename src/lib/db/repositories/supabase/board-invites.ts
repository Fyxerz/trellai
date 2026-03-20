import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { IBoardInviteRepository, BoardInviteRow } from "../types";

function toBoardInviteRow(row: Record<string, unknown>): BoardInviteRow {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    email: row.email as string,
    role: row.role as BoardInviteRow["role"],
    status: row.status as BoardInviteRow["status"],
    invitedBy: row.invited_by as string,
    createdAt: row.created_at as string,
  };
}

export class SupabaseBoardInviteRepository implements IBoardInviteRepository {
  private _client: SupabaseClient | null;

  constructor(client?: SupabaseClient) {
    this._client = client ?? null;
  }

  private get client() {
    return this._client ?? getSupabaseClient();
  }

  async findById(id: string): Promise<BoardInviteRow | undefined> {
    const { data, error } = await this.client
      .from("board_invites")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toBoardInviteRow(data) : undefined;
  }

  async findByProjectId(projectId: string): Promise<BoardInviteRow[]> {
    const { data, error } = await this.client
      .from("board_invites")
      .select("*")
      .eq("project_id", projectId);
    if (error) throw error;
    return (data ?? []).map(toBoardInviteRow);
  }

  async findByEmail(email: string): Promise<BoardInviteRow[]> {
    const { data, error } = await this.client
      .from("board_invites")
      .select("*")
      .eq("email", email);
    if (error) throw error;
    return (data ?? []).map(toBoardInviteRow);
  }

  async findPendingByEmail(email: string): Promise<BoardInviteRow[]> {
    const { data, error } = await this.client
      .from("board_invites")
      .select("*")
      .eq("email", email)
      .eq("status", "pending");
    if (error) throw error;
    return (data ?? []).map(toBoardInviteRow);
  }

  async create(data: Omit<BoardInviteRow, "id" | "status" | "createdAt"> & { id?: string }): Promise<BoardInviteRow> {
    const insertData: Record<string, unknown> = {
      project_id: data.projectId,
      email: data.email,
      role: data.role,
      invited_by: data.invitedBy,
    };
    if (data.id) insertData.id = data.id;

    const { data: result, error } = await this.client
      .from("board_invites")
      .insert(insertData)
      .select()
      .single();
    if (error) throw error;
    return toBoardInviteRow(result);
  }

  async update(id: string, data: Partial<Pick<BoardInviteRow, "status" | "role">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.role !== undefined) updateData.role = data.role;
    if (Object.keys(updateData).length > 0) {
      const { error } = await this.client.from("board_invites").update(updateData).eq("id", id);
      if (error) throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("board_invites").delete().eq("id", id);
    if (error) throw error;
  }
}
