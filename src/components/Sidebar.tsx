"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileStack, FileText, FolderOpen, Gauge, Layers, ShieldCheck, Sparkles, UserPen, Waypoints } from "lucide-react";
import type { Role } from "@/lib/types";
import { useWorkspace } from "./workspace";

export function Sidebar() {
  const path = usePathname();
  const { ws, setBagOpen, t, identity, setIdentity } = useWorkspace();
  const bag = ws?.bag.length ?? 0;
  const NAV = [
    { href: "/", label: t.nav.overview, icon: Gauge },
    { href: "/sources", label: t.nav.sources, icon: FileStack },
    { href: "/claims", label: t.nav.claims, icon: Layers },
    { href: "/report", label: t.nav.report, icon: FileText },
    { href: "/traces", label: t.nav.traces, icon: Waypoints },
    { href: "/method", label: t.nav.method, icon: Sparkles },
  ];
  const roles: { role: Role; label: string; Icon: typeof UserPen }[] = [
    { role: "officer", label: t.nav.officer, Icon: UserPen },
    { role: "reviewer", label: t.nav.reviewer, Icon: ShieldCheck },
  ];
  return (
    <aside className="no-print border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r">
      <div className="px-4 pb-3 pt-4 md:px-5 md:pt-6">
        <div className="flex items-center gap-2.5">
          {/* marque propre au prototype (pas le logo du client) */}
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] bg-accent text-[12px] font-black tracking-tight text-on-accent" aria-hidden>
            ED
          </span>
          <div className="leading-tight">
            <div className="text-[17px] font-bold tracking-tight">Evidence Desk</div>
            <div className="text-[11px] text-muted">{t.nav.tagline}</div>
          </div>
        </div>
        <div className="mt-3 rounded-[3px] bg-accent-soft px-2.5 py-1.5 text-[11px] leading-4 text-accent-ink">
          <div className="font-bold uppercase tracking-wider">
            {t.nav.client}: {ws?.client ?? "Schmitz-Stiftungen"}
          </div>
          <div className="truncate" title={ws?.caseName}>{ws?.caseName ?? "C08"}</div>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 border-l-[3px] px-3 py-2 text-[15px] transition-colors ${
                active ? "border-accent bg-accent-soft font-bold text-accent-ink" : "border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon size={16} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
        <button
          onClick={() => setBagOpen(true)}
          className="flex shrink-0 items-center gap-2.5 rounded-[3px] border border-line px-3 py-2 text-[15px] text-ink-2 hover:bg-surface-2 md:mt-2"
        >
          <FolderOpen size={16} strokeWidth={1.8} />
          {t.nav.bag}
          <span className={`ml-auto rounded-full px-1.5 text-[11px] font-bold ${bag ? "bg-accent text-on-accent" : "bg-surface-2 text-muted"}`}>{bag}</span>
        </button>
      </nav>

      <div className="mx-3 mb-3 rounded-[3px] border border-line p-3" data-testid="role-switch">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{t.nav.signedIn}</div>
        <div className="mt-2 grid gap-1" role="radiogroup">
          {roles.map(({ role, label, Icon }) => (
            <button
              key={role}
              role="radio"
              aria-checked={identity.role === role}
              onClick={() => setIdentity({ ...identity, role })}
              className={`flex items-center gap-2 rounded-[3px] px-2 py-1.5 text-left text-[13px] ${
                identity.role === role ? "bg-accent text-on-accent" : "text-ink-2 hover:bg-surface-2"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <input
          aria-label={t.nav.namePh}
          value={identity.names[identity.role]}
          onChange={(e) => setIdentity({ ...identity, names: { ...identity.names, [identity.role]: e.target.value } })}
          placeholder={t.nav.namePh}
          className="mt-2 w-full rounded-[3px] border border-line bg-surface px-2 py-1 text-[13px]"
        />
        <div className="mt-1.5 text-[11px] leading-4 text-muted">{t.nav.noAuth}</div>
      </div>

      <div className="hidden px-5 pb-6 text-[11px] leading-relaxed text-muted md:block">
        {t.nav.principle}
        {ws && (
          <div className="mt-3 space-y-0.5">
            <div>{t.nav.reader}: {ws.models.reader}</div>
            <div>{t.nav.writer}: {ws.models.writer}</div>
            {!ws.apiKey && <div className="text-critical-ink">{t.nav.noKey}</div>}
          </div>
        )}
      </div>
    </aside>
  );
}
