"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Beaker, Bell, BookOpen, Building2, FlaskConical, FolderKanban, Gauge, Inbox, LayoutDashboard, Library, Lightbulb,
  ListChecks, Megaphone, Network, NotebookPen, Radio, ScrollText, Search, Shapes, ShieldCheck, Sparkles, Trophy, Users,
  type LucideIcon,
} from "lucide-react";
import type { NavSection } from "@/components/portal/shell/nav-config";
import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Beaker, Bell, BookOpen, Building2, FlaskConical, FolderKanban, Gauge, Inbox, LayoutDashboard, Library, Lightbulb,
  ListChecks, Megaphone, Network, NotebookPen, Radio, ScrollText, Search, Shapes, ShieldCheck, Sparkles, Trophy, Users,
};

export function isActive(pathname: string, href: string) {
  return href === "/portal" ? pathname === "/portal" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  // Most specific match wins so "/portal/admin" isn't highlighted on "/portal/admin/users".
  const all = sections.flatMap((s) => s.items.map((i) => i.href));
  const activeHref = all.filter((h) => isActive(pathname, h)).sort((a, b) => b.length - a.length)[0];
  return (
    <nav aria-label="Portal" className="flex flex-col gap-6 px-3 py-4">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="px-3 pb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">{section.label}</p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active = item.href === activeHref;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      active && "bg-sidebar-accent font-medium text-white shadow-[inset_2px_0_0_var(--brand-green)]",
                    )}
                  >
                    <Icon className={cn("size-4", active ? "text-brand-green" : "text-sidebar-foreground/60")} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ sections }: { sections: NavSection[] }) {
  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-6">
        <Link href="/portal" aria-label="azentio.ai portal home">
          <Wordmark inverted />
        </Link>
      </div>
      <SidebarNav sections={sections} />
      <div className="mt-auto border-t border-sidebar-border px-6 py-4 text-xs text-sidebar-foreground/50">
        <Link href="/" className="hover:text-white">
          ← Public website
        </Link>
      </div>
    </aside>
  );
}
