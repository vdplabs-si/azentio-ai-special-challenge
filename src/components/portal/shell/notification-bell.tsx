"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ items: Item[]; unreadCount: number }>("/api/v1/notifications?limit=8");
      setItems(res.items);
      setUnread(res.unreadCount);
    } catch {
      /* transient — the bell retries on the next interval */
    }
  }, []);

  useEffect(() => {
    // Initial fetch is deferred a tick so the effect doesn't set state synchronously.
    const first = setTimeout(load, 0);
    const id = setInterval(load, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  async function open_(item: Item) {
    try {
      if (!item.readAt) await apiFetch(`/api/v1/notifications/${item.id}`, { method: "PATCH" });
      setOpen(false);
      await load();
      if (item.link) router.push(item.link);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function readAll() {
    try {
      await apiFetch("/api/v1/notifications/read-all", { method: "POST" });
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) void load(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-brand-green px-1 text-[0.65rem] font-bold text-brand-ink">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="sm" onClick={readAll} disabled={unread === 0}>
            <CheckCheck className="size-3.5" /> Mark all read
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open_(n)}
                  className={cn("w-full px-4 py-3 text-left hover:bg-muted", !n.readAt && "bg-accent/60")}
                >
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {!n.readAt && <span className="size-1.5 rounded-full bg-success" aria-label="Unread" />}
                    {n.title}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t px-4 py-2 text-right">
          <Link href="/portal/notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
