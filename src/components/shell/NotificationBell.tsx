"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, HelpingHand, CheckCircle2, Gift, HandHeart, Sparkles } from "lucide-react";
import { Notification, NotificationType } from "@/domain/types";
import { api } from "@/components/lib/api";
import { useSession } from "@/components/providers/SessionProvider";
import { relativeTime } from "@/components/lib/labels";
import { cn } from "@/components/ui/cn";

const ICONS: Record<NotificationType, typeof Bell> = {
  NEARBY_REQUEST: HandHeart,
  NEW_OFFER: HelpingHand,
  OFFER_ACCEPTED: CheckCircle2,
  OFFER_DECLINED: Bell,
  REQUEST_RESOLVED: Sparkles,
  RESOURCE_REQUEST: HelpingHand,
  REQUEST_ACCEPTED: CheckCircle2,
  POINTS_AWARDED: Gift,
};

const POLL_MS = 20_000;

export function NotificationBell() {
  const { actorId } = useSession();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.notifications();
      setItems(r.items);
      setUnread(r.unread);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void load();
    timer.current = setInterval(load, POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load, actorId]);

  const openAndMark = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((cur) => cur.map((n) => ({ ...n, read: true })));
      try {
        await api.markNotificationsRead();
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={openAndMark}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[var(--color-cream)] hover:bg-white/20"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-coral)] px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-lift)]"
            role="menu"
          >
            <div className="border-b border-[var(--color-line)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)]">
              Notifications
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--color-ink-soft)]">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="max-h-96 divide-y divide-[var(--color-line)] overflow-auto">
                {items.map((n) => {
                  const Icon = ICONS[n.type] ?? Bell;
                  const content = (
                    <span className="flex gap-3 px-4 py-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-weak)] text-[var(--color-brand)]">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--color-ink)]">{n.title}</span>
                        {n.body && <span className="block text-xs text-[var(--color-ink-soft)]">{n.body}</span>}
                        <span className="mt-0.5 block text-[11px] text-[var(--color-ink-soft)]">
                          {relativeTime(n.createdAt)}
                        </span>
                      </span>
                    </span>
                  );
                  return (
                    <li key={n.id} className={cn(!n.read && "bg-[var(--color-accent-weak)]/40")}>
                      {n.href ? (
                        <Link href={n.href} onClick={() => setOpen(false)} className="block hover:bg-[var(--color-accent-weak)]/60">
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
