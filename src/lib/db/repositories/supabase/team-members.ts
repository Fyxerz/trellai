import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ITeamMemberRepository, TeamMemberRow } from "../types";

function toTeamMemberRow(row: Record<string, unknown>): TeamMemberRow {
  return {
    id: row.id as string,
    teamId: row.team_id as string,
    userId: row.user_id as string,
    role: row.role as TeamMemberRow["role"],
    createdAt: row.created_at as string,
  };
}

export class SupabaseTeamMemberRepository implements ITeamMemberRepository {
  private _client: SupabaseClient | null;

  constructor(client?: SupabaseClient) {
    this._client = client ?? null;
  }

  private get client() {
    return this._client ?? getSupabaseClient();
  }

  async findByTeamId(teamId: string): Promise<TeamMemberRow[]> {
    const { data, error } = await this.client
      .from("team_members")
      .select("*")
      .eq("team_id", teamId);
    if (error) throw error;
    return (data ?? []).map(toTeamMemberRow);
  }

  async findByUserId(userId: string): Promise<TeamMemberRow[]> {
    const { data, error } = await this.client
      .from("team_members")
      .select("*")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map(toTeamMemberRow);
  }

  async findByTeamAndUser(teamId: string, userId: string): Promise<TeamMemberRow | undefined> {
    const { data, error } = await this.client
      .from("team_members")
      .select("*")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? toTeamMemberRow(data) : undefined;
  }

  async create(data: Omit<TeamMemberRow, "id" | "createdAt"> & { id?: string }): Promise<void> {
    const insertData: Record<string, unknown> = {
      team_id: data.teamId,
      user_id: data.userId,
      role: data.role,
    };
    if (data.id) insertData.id = data.id;

    const { error } = await this.client.from("team_members").insert(insertData);
    if (error) throw error;
  }

  async update(id: string, data: Partial<Pick<TeamMemberRow, "role">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.role !== undefined) updateData.role = data.role;
    if (Object.keys(updateData).length > 0) {
      const { error } = await this.client.from("team_members").update(updateData).eq("id", id);
      if (error) throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("team_members").delete().eq("id", id);
    if (error) throw error;
  }

  async deleteByTeamAndUser(teamId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", userId);
    if (error) throw error;
  }
}
