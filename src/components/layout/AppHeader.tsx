"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface AppHeaderProps {
  breadcrumbs: Breadcrumb[];
  actions?: React.ReactNode;
}

export function AppHeader({ breadcrumbs, actions }: AppHeaderProps) {
  return (
    <header className="relative z-10 flex items-center justify-between px-8 py-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-white/90 hover:text-white transition-colors"
        >
          Trellai
        </Link>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-3">
            <ChevronRight className="h-4 w-4 text-white/30" />
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="text-sm font-medium text-white/50 hover:text-white/80 transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-sm font-medium text-white/90">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}
