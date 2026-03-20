import { getSupabaseClient } from "@/lib/supabase/client";
import type { ITeamRepository, TeamRow } from "../types";

function toTeamRow(row: Record<string, unknown>): TeamRow {
  return {
    id: row.id as string,
    name: row.name as string,
    isPersonal: row.is_personal as boolean,
    createdAt: row.created_at as string,
  };
}

export class SupabaseTeamRepository implements ITeamRepository {
  private get client() {
    return getSupabaseClient();
  }

  async findById(id: string): Promise<TeamRow | undefined> {
    const { data, error } = await this.client
      .from("teams")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toTeamRow(data) : undefined;
  }

  async findByUserId(userId: string): Promise<TeamRow[]> {
    const { data, error } = await this.client
      .from("teams")
      .select("*, team_members!inner(user_id)")
      .eq("team_members.user_id", userId);
    if (error) throw error;
    return (data ?? []).map(toTeamRow);
  }

  async findPersonalTeam(userId: string): Promise<TeamRow | undefined> {
    const { data, error } = await this.client
      .from("teams")
      .select("*, team_members!inner(user_id)")
      .eq("team_members.user_id", userId)
      .eq("is_personal", true)
      .maybeSingle();
    if (error) throw error;
    return data ? toTeamRow(data) : undefined;
  }

  async create(data: Omit<TeamRow, "id" | "createdAt"> & { id?: string }): Promise<TeamRow> {
    const insertData: Record<string, unknown> = {
      name: data.name,
      is_personal: data.isPersonal,
    };
    if (data.id) insertData.id = data.id;

    const { data: result, error } = await this.client
      .from("teams")
      .insert(insertData)
      .select()
      .single();
    if (error) throw error;
    return toTeamRow(result);
  }

  async update(id: string, data: Partial<Pick<TeamRow, "name">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (Object.keys(updateData).length > 0) {
      const { error } = await this.client.from("teams").update(updateData).eq("id", id);
      if (error) throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("teams").delete().eq("id", id);
    if (error) throw error;
  }
}
