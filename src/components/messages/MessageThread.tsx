"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { ConversationView, Message } from "@/domain/types";
import { api } from "@/components/lib/api";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { UserLink } from "@/components/community/UserLink";
import { relativeTime } from "@/components/lib/labels";
import { cn } from "@/components/ui/cn";

const POLL_MS = 5000;

export function MessageThread({ conversationId }: { conversationId: string }) {
  const { actorId } = useSession();
  const toast = useToast();
  const [conversation, setConversation] = useState<ConversationView | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (scroll = false) => {
      try {
        const r = await api.getConversation(conversationId);
        setConversation(r.conversation);
        setMessages(r.messages);
        if (scroll) requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
      } catch {
        /* non-fatal during polling */
      } finally {
        setLoading(false);
      }
    },
    [conversationId],
  );

  useEffect(() => {
    void load(true);
    const t = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(t);
  }, [load, actorId]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setDraft("");
    // Optimistic append (rolled back on failure).
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      conversationId,
      senderId: actorId ?? "",
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    try {
      await api.sendMessage(conversationId, body);
      await load(true);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(body);
      toast.error(e instanceof Error ? e.message : "Message failed to send.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand)]" aria-hidden />
      </div>
    );
  }
  if (!conversation) {
    return <div className="flex h-full items-center justify-center text-sm text-[var(--color-ink-soft)]">Conversation not found.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3">
        {(() => {
          const otherId = conversation.participantIds.find((p) => p !== actorId);
          return (
            <>
              <Avatar name={conversation.otherParticipantName} seed={otherId ?? conversation.otherParticipantName} />
              <div>
                <UserLink
                  userId={otherId}
                  name={conversation.otherParticipantName}
                  className="font-semibold text-[var(--color-ink)]"
                />
                <p className="text-xs text-[var(--color-ink-soft)]">About: {conversation.subject}</p>
              </div>
            </>
          );
        })()}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-auto p-4" aria-live="polite">
        {messages.length === 0 ? (
          <p className="pt-10 text-center text-sm text-[var(--color-ink-soft)]">
            No messages yet. Say hello and arrange the handoff.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === actorId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-[var(--shadow-soft)]",
                    mine
                      ? "rounded-br-sm bg-[var(--color-brand)] text-white"
                      : "rounded-bl-sm bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-line)]",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={cn("mt-1 text-[10px]", mine ? "text-white/70" : "text-[var(--color-ink-soft)]")}>
                    {relativeTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--color-line)] p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Write a message…"
            className="max-h-32 min-h-[42px] flex-1 resize-none rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]"
            aria-label="Write a message"
          />
          <button
            onClick={send}
            disabled={sending || !draft.trim()}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-accent)] text-white disabled:opacity-50"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}
