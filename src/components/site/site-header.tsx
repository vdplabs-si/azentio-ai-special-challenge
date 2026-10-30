"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogIn, Menu } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ctaClasses } from "@/components/site/cta-link";
import { MAIN_NAV, isNavGroup, type NavLink } from "@/content/site";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const topLink =
  "inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light hover:text-brand-navy focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:text-brand-navy aria-[current=page]:underline aria-[current=page]:decoration-brand-green aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-[10px]";

function DesktopGroup({ label, items, pathname }: { label: string; items: NavLink[]; pathname: string }) {
  const active = items.some((i) => isActive(pathname, i.href));
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={cn(
          topLink,
          "data-[state=open]:bg-brand-light",
          active && "text-brand-navy underline decoration-brand-green decoration-2 underline-offset-[10px]",
        )}
      >
        {label}
        <ChevronDown aria-hidden="true" className="size-3.5 text-brand-muted transition-transform in-data-[state=open]:rotate-180 motion-reduce:transition-none" />
        {active ? <span className="sr-only"> (current section)</span> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-80 p-2">
        {items.map((item) => (
          <DropdownMenuItem key={item.href} asChild className="cursor-pointer rounded-md px-3 py-2.5">
            <Link href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-brand-ink">{item.label}</span>
                {item.description ? <span className="text-xs text-muted-foreground">{item.description}</span> : null}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const linkClass =
    "flex items-center rounded-md px-3 py-2.5 text-base font-medium text-brand-ink hover:bg-brand-light focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:bg-accent aria-[current=page]:text-brand-navy";
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="lg:hidden" aria-label="Open menu">
          <Menu aria-hidden="true" className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-sm">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle asChild>
            <div>
              <Wordmark />
              <span className="sr-only">Site navigation</span>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Links to every public section of azentio.ai.</SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col gap-5 px-3 py-5">
          <ul className="flex flex-col gap-0.5">
            {MAIN_NAV.filter((e) => !isNavGroup(e)).map((e) => {
              const item = e as NavLink;
              return (
                <li key={item.href}>
                  <SheetClose asChild>
                    <Link href={item.href} className={linkClass} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
                      {item.label}
                    </Link>
                  </SheetClose>
                </li>
              );
            })}
          </ul>
          {MAIN_NAV.filter(isNavGroup).map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <p className="px-3 text-xs font-semibold tracking-[0.16em] text-brand-muted uppercase">{group.label}</p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <SheetClose asChild>
                      <Link href={item.href} className={linkClass} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
                        {item.label}
                      </Link>
                    </SheetClose>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-border p-5">
          <SheetClose asChild>
            <Link href="/connect" className={ctaClasses("navy", "lg", "w-full")}>
              Request Demo
            </Link>
          </SheetClose>
          <div className="grid grid-cols-2 gap-2">
            <SheetClose asChild>
              <Link href="/login" className={ctaClasses("outline-light", "lg", "w-full")}>
                Sign in
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link href="/portal" className={ctaClasses("outline-light", "lg", "w-full")}>
                Portal
              </Link>
            </SheetClose>
          </div>
          <p className="pt-1 text-xs text-muted-foreground">The portal is for invited clients and approved employees.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Wordmark className="text-[1.375rem]" />
          <span className="sr-only">, home</span>
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {MAIN_NAV.map((entry) =>
              isNavGroup(entry) ? (
                <li key={entry.label}>
                  <DesktopGroup label={entry.label} items={entry.items} pathname={pathname} />
                </li>
              ) : (
                <li key={entry.href}>
                  <Link href={entry.href} className={topLink} aria-current={isActive(pathname, entry.href) ? "page" : undefined}>
                    {entry.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link href="/login" className={cn(topLink, "hidden lg:inline-flex")}>
            <LogIn aria-hidden="true" className="size-4 text-brand-muted" />
            Sign in
          </Link>
          <Link href="/portal" className={ctaClasses("outline-light", "md", "hidden lg:inline-flex")}>
            Portal
          </Link>
          <Link href="/connect" className={ctaClasses("navy", "md", "hidden sm:inline-flex")}>
            Request Demo
          </Link>
          <MobileNav pathname={pathname} />
        </div>
      </div>
    </header>
  );
}
