"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, LogOut, Menu, User } from "lucide-react";
import { toast } from "sonner";
import type { NavSection } from "@/components/portal/shell/nav-config";
import { SEGMENT_LABELS } from "@/components/portal/shell/nav-config";
import { SidebarNav } from "@/components/portal/shell/sidebar";
import { NotificationBell } from "@/components/portal/shell/notification-bell";
import { Wordmark } from "@/components/brand/wordmark";
import type { SerializedActor } from "@/lib/authz/serialize";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

function Crumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = parts.map((seg, i) => ({
    href: "/" + parts.slice(0, i + 1).join("/"),
    label: SEGMENT_LABELS[seg] ?? "Details",
  }));
  return (
    <Breadcrumb className="hidden md:block">
      <BreadcrumbList>
        {crumbs.map((c, i) => (
          <Fragment key={c.href}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {i === crumbs.length - 1 ? (
                <BreadcrumbPage>{c.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={c.href}>{c.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function WorkspaceSwitcher({ actor }: { actor: SerializedActor }) {
  const router = useRouter();
  const active = actor.activeOrganisation;
  if (!active) return null;
  async function switchTo(id: string) {
    try {
      await apiFetch("/api/v1/session/active-organisation", { body: { organisationId: id } });
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="lg" className="max-w-[16rem] gap-2" aria-label="Switch active workspace">
          <Building2 className="size-4 text-brand-muted" aria-hidden />
          <span className="truncate">{active.name}</span>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {active.type === "INTERNAL" ? "Employee" : "Client"}
          </Badge>
          {actor.memberships.length > 1 && <ChevronsUpDown className="size-3.5 text-brand-muted" aria-hidden />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Active workspace</DropdownMenuLabel>
        {actor.memberships.map((m) => (
          <DropdownMenuItem key={m.id} onSelect={() => m.id !== active.id && switchTo(m.id)}>
            <span className="flex-1 truncate">{m.name}</span>
            <span className="text-xs text-muted-foreground">{m.role.toLowerCase()}</span>
            {m.id === active.id && <Check className="size-4 text-success" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ actor }: { actor: SerializedActor }) {
  const router = useRouter();
  const user = actor.user!;
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label="Account menu">
          <Avatar className="size-8">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback className="bg-brand-navy text-xs text-white">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-medium text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          {actor.roles.length > 0 && (
            <p className="mt-1 text-[0.7rem] text-muted-foreground">{actor.roles.map((r) => r.replace(/_/g, " ").toLowerCase()).join(" · ")}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/portal/profile">
            <User className="size-4" aria-hidden /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={logout}>
          <LogOut className="size-4" aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PortalHeader({ actor, sections }: { actor: SerializedActor; sections: NavSection[] }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-lg" className="lg:hidden" aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 overflow-y-auto border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetHeader className="h-16 justify-center px-6">
            <SheetTitle>
              <Wordmark inverted />
            </SheetTitle>
          </SheetHeader>
          <SidebarNav sections={sections} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <WorkspaceSwitcher actor={actor} />
      <Crumbs />
      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
        <UserMenu actor={actor} />
      </div>
    </header>
  );
}
