"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";

import { TeamSettingsPanel } from "@/components/teams/TeamSettingsPanel";
import type { Team } from "@/types";

export default function TeamSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${id}`);
      if (res.ok) {
        setTeam(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch team:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleRename = async (name: string) => {
    const res = await fetch(`/api/teams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to rename team");
    const updated = await res.json();
    setTeam(updated);
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete team");
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col">
        <AppHeader breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Team Settings" }]} />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex h-screen flex-col">
        <AppHeader breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Team Not Found" }]} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-white/50">Team not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: team.name },
          { label: "Settings" },
        ]}
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-white mb-8">
            Team Settings
          </h1>

          <TeamSettingsPanel
            team={team}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}
