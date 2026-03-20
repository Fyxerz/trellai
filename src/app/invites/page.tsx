"use client";
import { useState } from "react";
import { Loader2, Mail, Check, X, ArrowLeft, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";

import { useMyInvites } from "@/hooks/useInvites";
import { useMyBoardInvites } from "@/hooks/useBoardInvites";

export default function InvitesPage() {
  const { invites: teamInvites, loading: teamLoading, respondToInvite: respondToTeamInvite } = useMyInvites();
  const { invites: boardInvites, loading: boardLoading, respondToInvite: respondToBoardInvite } = useMyBoardInvites();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleTeamRespond = async (inviteId: string, action: "accept" | "decline") => {
    setActionLoading(inviteId);
    try {
      await respondToTeamInvite(inviteId, action);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to respond to invite");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBoardRespond = async (inviteId: string, action: "accept" | "decline") => {
    setActionLoading(inviteId);
    try {
      await respondToBoardInvite(inviteId, action);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to respond to invite");
    } finally {
      setActionLoading(null);
    }
  };

  const loading = teamLoading && boardLoading;
  const noInvites = teamInvites.length === 0 && boardInvites.length === 0;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Invitations" },
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
            Invitations
          </h1>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-white/30" />
            </div>
          ) : noInvites ? (
            <div className="glass-card rounded-xl p-8 text-center border border-white/5">
              <Mail className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/50">No pending invitations.</p>
              <p className="text-sm text-white/30 mt-1">
                When someone invites you to a team or board, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Team Invites */}
              {teamInvites.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium uppercase text-white/40 mb-3">
                    Team Invitations
                  </h2>
                  <div className="space-y-3">
                    {teamInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="glass-card rounded-xl p-5 flex items-center justify-between border border-white/5"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-400/20 to-indigo-500/20">
                            <Mail className="h-5 w-5 text-violet-400/70" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white/90">
                              Team Invite
                            </p>
                            <p className="text-xs text-white/40 mt-0.5">
                              Invited as <span className="text-white/60">{invite.role}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                            onClick={() => handleTeamRespond(invite.id, "accept")}
                            disabled={actionLoading === invite.id}
                          >
                            <Check className="h-4 w-4" />
                            Accept
                          </button>
                          <button
                            className="flex items-center gap-1.5 rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors disabled:opacity-40"
                            onClick={() => handleTeamRespond(invite.id, "decline")}
                            disabled={actionLoading === invite.id}
                          >
                            <X className="h-4 w-4" />
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Board Invites */}
              {boardInvites.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium uppercase text-white/40 mb-3">
                    Board Invitations
                  </h2>
                  <div className="space-y-3">
                    {boardInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="glass-card rounded-xl p-5 flex items-center justify-between border border-white/5"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/20 to-cyan-500/20">
                            <LayoutDashboard className="h-5 w-5 text-indigo-400/70" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white/90">
                              Board Invite
                            </p>
                            <p className="text-xs text-white/40 mt-0.5">
                              Invited as <span className="text-white/60">{invite.role}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                            onClick={() => handleBoardRespond(invite.id, "accept")}
                            disabled={actionLoading === invite.id}
                          >
                            <Check className="h-4 w-4" />
                            Accept
                          </button>
                          <button
                            className="flex items-center gap-1.5 rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors disabled:opacity-40"
                            onClick={() => handleBoardRespond(invite.id, "decline")}
                            disabled={actionLoading === invite.id}
                          >
                            <X className="h-4 w-4" />
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
