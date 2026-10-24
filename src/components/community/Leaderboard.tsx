"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Medal, ArrowRight } from "lucide-react";
import { api } from "@/components/lib/api";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";

interface Row {
  userId: string;
  name: string;
  contributions: number;
  points: number;
}

export function Leaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<{ contributions: number; points: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .points()
      .then((d) => {
        setRows(d.impact.topContributors.slice(0, 5));
        setTotals({ contributions: d.impact.totalContributions, points: d.impact.totalPointsAwarded });
      })
      .catch(() => void 0)
      .finally(() => setLoading(false));
  }, []);

  const medalColor = (i: number) =>
    i === 0 ? "text-[#c99a2e]" : i === 1 ? "text-[#9aa0a6]" : i === 2 ? "text-[#b4794a]" : "text-[var(--color-ink-soft)]";

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-2xl font-semibold text-[var(--color-ink)]">
            <Trophy className="h-5 w-5 text-[var(--color-accent)]" aria-hidden />
            Top neighbors this season
          </h2>
          <p className="text-sm text-[var(--color-ink-soft)]">
            Celebrating the people showing up for the community
            {totals && totals.contributions > 0 && ` · ${totals.contributions} helped so far`}.
          </p>
        </div>
        <Link href="/points" className="hidden text-sm font-medium text-[var(--color-brand)] hover:underline sm:block">
          How points work
        </Link>
      </div>

      <Card className="divide-y divide-[var(--color-line)]">
        {loading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--color-ink-soft)]">
            No contributions yet — be the first to help a neighbor.
          </p>
        ) : (
          rows.map((r, i) => (
            <Link
              key={r.userId}
              href={`/u/${r.userId}`}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-[var(--color-brand-weak)]/50"
            >
              <span className={cn("flex w-6 shrink-0 justify-center", medalColor(i))}>
                {i < 3 ? <Medal className="h-5 w-5" aria-hidden /> : <span className="font-semibold">{i + 1}</span>}
              </span>
              <Avatar name={r.name} seed={r.userId} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[var(--color-ink)]">{r.name}</span>
                <span className="block text-xs text-[var(--color-ink-soft)]">
                  {r.contributions} neighbor{r.contributions === 1 ? "" : "s"} helped
                </span>
              </span>
              <span className="font-display text-lg font-semibold text-[var(--color-accent)]">{r.points}</span>
              <ArrowRight className="h-4 w-4 text-[var(--color-ink-soft)]" aria-hidden />
            </Link>
          ))
        )}
      </Card>
    </section>
  );
}
