"use client";
import { useCallback, useEffect, useState } from "react";
import { Inbox, Send, CheckCircle2, History } from "lucide-react";
import { Request, RequestStatus } from "@/domain/types";
import { api } from "@/components/lib/api";
import { useSession } from "@/components/providers/SessionProvider";
import { RequestRow } from "@/components/requests/RequestRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";

type Tab = "incoming" | "outgoing" | "active" | "history";

const HISTORY_STATUSES: RequestStatus[] = [
  RequestStatus.COMPLETED,
  RequestStatus.DECLINED,
  RequestStatus.CANCELLED,
];

export default function ActivityPage() {
  const { actorId, loading: sessionLoading } = useSession();
  const [tab, setTab] = useState<Tab>("incoming");
  const [outgoing, setOutgoing] = useState<Request[]>([]);
  const [incoming, setIncoming] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listRequests();
      setOutgoing(res.outgoing);
      setIncoming(res.incoming);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading, actorId]);

  const incomingPending = incoming.filter((r) => r.status === RequestStatus.PENDING);
  const active = [...incoming, ...outgoing].filter((r) => r.status === RequestStatus.ACCEPTED);
  const history = [...incoming, ...outgoing].filter((r) => HISTORY_STATUSES.includes(r.status));

  const tabs: Array<{ id: Tab; label: string; icon: typeof Inbox; count: number }> = [
    { id: "incoming", label: "Incoming", icon: Inbox, count: incomingPending.length },
    { id: "outgoing", label: "Outgoing", icon: Send, count: outgoing.filter((r) => r.status === RequestStatus.PENDING).length },
    { id: "active", label: "Active", icon: CheckCircle2, count: active.length },
    { id: "history", label: "History", icon: History, count: history.length },
  ];

  const rows: Request[] =
    tab === "incoming" ? incoming : tab === "outgoing" ? outgoing : tab === "active" ? active : history;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">My Activity</h1>
        <p className="mt-1 text-[var(--color-ink-soft)]">Requests you&apos;ve sent and received.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-line)]" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-[var(--color-accent)] text-[var(--color-brand)]"
                : "border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]",
            )}
          >
            <t.icon className="h-4 w-4" aria-hidden />
            {t.label}
            {t.count > 0 && (
              <span className="rounded-full bg-[var(--color-accent-weak)] px-1.5 text-xs text-[var(--color-brand)]">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-12 text-center text-sm text-[var(--color-ink-soft)]">
          Nothing here yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              perspective={r.resourceOwnerId === actorId ? "owner" : "requester"}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
