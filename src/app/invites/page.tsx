"use client";
import { useState } from "react";
import { Loader2, Mail, Check, X, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { UserMenu } from "@/components/layout/UserMenu";
import { useMyInvites } from "@/hooks/useInvites";

export default function InvitesPage() {
  const { invites, loading, respondToInvite } = useMyInvites();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleRespond = async (inviteId: string, action: "accept" | "decline") => {
    setActionLoading(inviteId);
    try {
      await respondToInvite(inviteId, action);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to respond to invite");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Invitations" },
        ]}
        actions={<UserMenu />}
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
            Team Invitations
          </h1>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-white/30" />
            </div>
          ) : invites.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center border border-white/5">
              <Mail className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/50">No pending invitations.</p>
              <p className="text-sm text-white/30 mt-1">
                When someone invites you to a team, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => (
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
                      onClick={() => handleRespond(invite.id, "accept")}
                      disabled={actionLoading === invite.id}
                    >
                      <Check className="h-4 w-4" />
                      Accept
                    </button>
                    <button
                      className="flex items-center gap-1.5 rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors disabled:opacity-40"
                      onClick={() => handleRespond(invite.id, "decline")}
                      disabled={actionLoading === invite.id}
                    >
                      <X className="h-4 w-4" />
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
