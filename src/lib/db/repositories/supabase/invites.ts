import { getSupabaseClient } from "@/lib/supabase/client";
import type { IInviteRepository, InviteRow } from "../types";

function toInviteRow(row: Record<string, unknown>): InviteRow {
  return {
    id: row.id as string,
    teamId: row.team_id as string,
    email: row.email as string,
    role: row.role as InviteRow["role"],
    status: row.status as InviteRow["status"],
    invitedBy: row.invited_by as string,
    createdAt: row.created_at as string,
  };
}

export class SupabaseInviteRepository implements IInviteRepository {
  private get client() {
    return getSupabaseClient();
  }

  async findById(id: string): Promise<InviteRow | undefined> {
    const { data, error } = await this.client
      .from("invites")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toInviteRow(data) : undefined;
  }

  async findByTeamId(teamId: string): Promise<InviteRow[]> {
    const { data, error } = await this.client
      .from("invites")
      .select("*")
      .eq("team_id", teamId);
    if (error) throw error;
    return (data ?? []).map(toInviteRow);
  }

  async findByEmail(email: string): Promise<InviteRow[]> {
    const { data, error } = await this.client
      .from("invites")
      .select("*")
      .eq("email", email);
    if (error) throw error;
    return (data ?? []).map(toInviteRow);
  }

  async findPendingByEmail(email: string): Promise<InviteRow[]> {
    const { data, error } = await this.client
      .from("invites")
      .select("*")
      .eq("email", email)
      .eq("status", "pending");
    if (error) throw error;
    return (data ?? []).map(toInviteRow);
  }

  async create(data: Omit<InviteRow, "id" | "status" | "createdAt"> & { id?: string }): Promise<InviteRow> {
    const insertData: Record<string, unknown> = {
      team_id: data.teamId,
      email: data.email,
      role: data.role,
      invited_by: data.invitedBy,
    };
    if (data.id) insertData.id = data.id;

    const { data: result, error } = await this.client
      .from("invites")
      .insert(insertData)
      .select()
      .single();
    if (error) throw error;
    return toInviteRow(result);
  }

  async update(id: string, data: Partial<Pick<InviteRow, "status" | "role">>): Promise<void> {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.role !== undefined) updateData.role = data.role;
    if (Object.keys(updateData).length > 0) {
      const { error } = await this.client.from("invites").update(updateData).eq("id", id);
      if (error) throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("invites").delete().eq("id", id);
    if (error) throw error;
  }
}
