/**
 * Auth layout — full-page split design with no app header.
 * Left side: branding + gradient illustration.
 * Right side: auth form (children).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left — Branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700">
        {/* Abstract decorative elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-indigo-400/15 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-violet-300/20 blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16">
          <h1 className="text-5xl font-bold text-white tracking-tight">
            Trellai
          </h1>
          <p className="mt-4 text-xl text-white/70 max-w-md leading-relaxed">
            Orchestrate Claude Code agents with a beautiful kanban board.
            Plan, build, and ship — powered by AI.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-white/50">
              AI agents ready to build
            </span>
          </div>
        </div>
      </div>

      {/* Right — Form panel */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
