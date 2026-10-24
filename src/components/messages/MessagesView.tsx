"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { ConversationView } from "@/domain/types";
import { api } from "@/components/lib/api";
import { useSession } from "@/components/providers/SessionProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import { relativeTime } from "@/components/lib/labels";
import { MessageThread } from "./MessageThread";
import { cn } from "@/components/ui/cn";

const POLL_MS = 8000;

export function MessagesView({ activeId }: { activeId?: string }) {
  const { actorId } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<ConversationView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.listConversations();
      setItems(r.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load, actorId, activeId]);

  return (
    <div className="grid h-[calc(100vh-10rem)] grid-cols-1 gap-0 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)] md:grid-cols-[320px_1fr]">
      {/* Conversation list */}
      <aside
        className={cn(
          "flex flex-col border-r border-[var(--color-line)]",
          activeId && "hidden md:flex",
        )}
      >
        <div className="border-b border-[var(--color-line)] px-4 py-3">
          <h1 className="font-display text-lg font-semibold text-[var(--color-ink)]">Messages</h1>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--color-ink-soft)]">
              No conversations yet. Accept an offer or get one accepted to start chatting.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {items.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/messages/${c.id}`}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-brand-weak)]/60",
                      activeId === c.id && "bg-[var(--color-brand-weak)]",
                    )}
                  >
                    <Avatar name={c.otherParticipantName} seed={c.participantIds.find((p) => p !== actorId) ?? c.otherParticipantName} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-[var(--color-ink)]">{c.otherParticipantName}</span>
                        {c.unreadForMe && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" aria-label="unread" />}
                      </span>
                      <span className="block truncate text-xs text-[var(--color-ink-soft)]">
                        {c.lastMessagePreview ?? `About ${c.subject}`}
                      </span>
                      {c.lastMessageAt && (
                        <span className="block text-[11px] text-[var(--color-ink-soft)]">{relativeTime(c.lastMessageAt)}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Thread pane */}
      <section className={cn("min-h-0", !activeId && "hidden md:block")}>
        {activeId ? (
          <div className="flex h-full flex-col">
            <button
              onClick={() => router.push("/messages")}
              className="flex items-center gap-1.5 border-b border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] md:hidden"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> All conversations
            </button>
            <div className="min-h-0 flex-1">
              <MessageThread conversationId={activeId} />
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <MessageCircle className="h-10 w-10 text-[var(--color-ink-soft)]" aria-hidden />
            <p className="mt-3 font-medium text-[var(--color-ink)]">Select a conversation</p>
            <p className="mt-1 max-w-xs text-sm text-[var(--color-ink-soft)]">
              Your chats about borrow requests and community help show up here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
