"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Info, CheckCircle2, AlertTriangle, HandHeart } from "lucide-react";
import { Alternative, PublicResource, RankedMatch } from "@/domain/types";
import { Interpretation } from "@/domain/interpretation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/components/lib/api";
import { RequestDialog } from "@/components/requests/RequestDialog";
import { CATEGORY_LABELS, relativeTime } from "@/components/lib/labels";

const EXAMPLE = "Our event starts in 15 minutes in the student union. The presenter's laptop only has USB-C, and the projector uses HDMI. We need a way to connect them immediately.";

const EXAMPLE_CHIPS = [
  { emoji: "🔌", label: "USB-C to a projector", text: EXAMPLE },
  { emoji: "🩹", label: "I'm bleeding, need a Band-Aid", text: "I cut my finger and I'm bleeding — I need a Band-Aid." },
  { emoji: "🧮", label: "Calculator for an exam", text: "I need a calculator for my exam this afternoon." },
  { emoji: "🪑", label: "Hands to set up tables", text: "We need another pair of hands to help set up tables for an event in 20 minutes." },
  { emoji: "☂️", label: "Umbrella in the rain", text: "It's pouring and I need an umbrella in the next 10 minutes." },
];

interface AnalyzeResponse {
  interpretation: Interpretation;
  matches: RankedMatch[];
  alternatives: Alternative[];
  rejected: Array<{ title: string; reason: string }>;
  noViableMatch: boolean;
  safety?: { blocked: true; message: string; guidance?: string };
  provider: string;
}

export function FixFlow({
  autofocus = false,
  initialText = "",
  autoRun = false,
}: {
  autofocus?: boolean;
  initialText?: string;
  autoRun?: boolean;
}) {
  const toast = useToast();
  const [text, setText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [requestResource, setRequestResource] = useState<PublicResource | null>(null);
  const didAutoRun = useRef(false);

  const run = async (problem: string) => {
    const value = problem.trim();
    if (!value) {
      toast.info("Describe what you need first.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await api.analyze({ text: value });
      setResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't analyze that. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-run once when arriving from the hero with a prefilled query.
  useEffect(() => {
    if (autoRun && initialText.trim() && !didAutoRun.current) {
      didAutoRun.current = true;
      void run(initialText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, initialText]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-4 sm:p-5">
        <label htmlFor="problem" className="mb-2 block text-sm font-medium text-[var(--color-ink)]">
          What&apos;s going wrong?
        </label>
        <Textarea
          id="problem"
          autoFocus={autofocus}
          value={text}
          maxLength={1200}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE}
          className="min-h-[96px] text-base"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(text);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => run(text)} loading={loading} size="lg">
            <Sparkles className="h-4 w-4" aria-hidden />
            Find a fix
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              setText(EXAMPLE);
              run(EXAMPLE);
            }}
            disabled={loading}
          >
            Try the example
          </Button>
          <span className="ml-auto hidden text-xs text-[var(--color-ink-soft)] sm:block">
            Tip: ⌘/Ctrl + Enter to submit
          </span>
        </div>

        {!result && !loading && (
          <div className="mt-4 border-t border-[var(--color-line)] pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">
              Try one of these
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_CHIPS.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => {
                    setText(ex.text);
                    run(ex.text);
                  }}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-canvas)] px-3 py-1.5 text-sm text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-weak)]"
                >
                  <span aria-hidden>{ex.emoji}</span>
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {loading && <LoadingResults />}

      {result && !loading && (
        <Results
          data={result}
          onRequest={(r) => setRequestResource(r)}
        />
      )}

      {requestResource && (
        <RequestDialog
          resource={requestResource}
          open={!!requestResource}
          onClose={() => setRequestResource(null)}
          onCreated={() => toast.info("Track it under My Activity.")}
        />
      )}
    </div>
  );
}

function LoadingResults() {
  return (
    <div className="flex flex-col gap-4" aria-live="polite" aria-busy="true">
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}

function Results({
  data,
  onRequest,
}: {
  data: AnalyzeResponse;
  onRequest: (r: PublicResource) => void;
}) {
  const { interpretation: i, matches, alternatives, rejected, noViableMatch, provider, safety } = data;

  if (safety?.blocked) {
    return (
      <Card className="border-l-4 border-[var(--color-danger)] p-5" aria-live="assertive">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--color-danger)]" aria-hidden />
          <div>
            <h2 className="font-semibold text-[var(--color-ink)]">We can&apos;t help with this one</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{safety.message}</p>
            {safety.guidance && (
              <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">{safety.guidance}</p>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      {/* Interpreted need recap */}
      <Card className="p-4 sm:p-5">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
            What we understood
          </h2>
          <Badge tone={provider === "ai" ? "accent" : "muted"}>
            {provider === "ai" ? "AI-assisted" : "Rule-based"}
          </Badge>
        </div>
        <p className="text-[var(--color-ink)]">{i.underlying_need}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {i.request_type !== "UNKNOWN" && <Badge tone="neutral">{i.request_type === "ASSISTANCE" ? "Assistance" : "Item"}</Badge>}
          {i.deadline && <Badge tone="amber">Needed {relativeTime(i.deadline)}</Badge>}
          {i.location_context && <Badge tone="neutral">{i.location_context}</Badge>}
          {(i.compatibility_constraints.sourcePorts.length > 0 ||
            i.compatibility_constraints.sinkPorts.length > 0) && (
            <Badge tone="neutral" className="font-mono text-[11px]">
              {i.compatibility_constraints.sourcePorts.join("/") || "—"} →{" "}
              {i.compatibility_constraints.sinkPorts.join("/") || "—"}
            </Badge>
          )}
        </div>
        {i.clarifying_question && (
          <p className="mt-3 inline-flex items-start gap-2 rounded-[var(--radius-control)] bg-[var(--color-amber-weak)] px-3 py-2 text-sm text-[var(--color-ink)]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-amber)]" aria-hidden />
            {i.clarifying_question}
          </p>
        )}
      </Card>

      {/* Primary matches */}
      {matches.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[var(--color-ink)]">
            Best options for you
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {matches.map((m) => (
              <MatchCard key={m.resource.id} match={m} onRequest={onRequest} />
            ))}
          </div>
        </section>
      )}

      {/* No feasible match — offer the community handoff */}
      {matches.length === 0 && (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--color-amber)]" aria-hidden />
            <div className="flex-1">
              <h2 className="font-semibold text-[var(--color-ink)]">
                {noViableMatch ? "No confirmed match right now" : "No exact match — but there are alternatives"}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                We only show options that are actually available and feasible. No one has this listed
                right now — but you can ask the community, and a neighbor nearby can step up.
              </p>
              <div className="mt-3">
                <Link
                  href={{
                    pathname: "/community/requests/new",
                    query: {
                      title: communityTitle(i),
                      description: i.problem_summary,
                      category: i.concepts.length ? undefined : undefined,
                    },
                  }}
                >
                  <Button>
                    <HandHeart className="h-4 w-4" aria-hidden />
                    Ask the community
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[var(--color-ink)]">Alternatives</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {alternatives.map((a) => (
              <Card key={a.resource.id} className="flex flex-col p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-ink)]">{a.resource.title}</span>
                  {a.needsConfirmation && <Badge tone="amber">Needs confirmation</Badge>}
                </div>
                <p className="text-sm text-[var(--color-ink-soft)]">{a.rationale}</p>
                <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                  {CATEGORY_LABELS[a.resource.category]} · {a.resource.location.zone}
                </p>
                <div className="mt-auto pt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onRequest(a.resource)}
                    disabled={a.needsConfirmation}
                  >
                    {a.needsConfirmation ? "Confirm availability first" : "Request this"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Ruled out (honest "why not") */}
      {rejected.length > 0 && (
        <details className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <summary className="cursor-pointer text-sm font-medium text-[var(--color-ink-soft)]">
            Why we ruled out {rejected.length} other option{rejected.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {rejected.map((r, idx) => (
              <li key={idx} className="text-sm text-[var(--color-ink-soft)]">
                <span className="font-medium text-[var(--color-ink)]">{r.title}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Derive a concise community-request title from the interpreted need. */
function communityTitle(i: Interpretation): string {
  // Prefer the first capability/search term as the subject; fall back to summary.
  const subject = i.required_capabilities[0] ?? i.suggested_search_terms[0];
  if (subject) return subject;
  return i.problem_summary.slice(0, 80);
}

function MatchCard({ match, onRequest }: { match: RankedMatch; onRequest: (r: PublicResource) => void }) {
  const { resource, explanation, walkMinutes, score } = match;
  return (
    <Card interactive className="flex flex-col p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-semibold text-[var(--color-ink)]">{resource.title}</h3>
        <Badge tone="accent">{Math.round(score.total * 100)}% fit</Badge>
      </div>

      <ul className="flex flex-col gap-1.5">
        {explanation.reasons.slice(0, 3).map((r, idx) => (
          <li key={idx} className="flex items-start gap-1.5 text-sm text-[var(--color-ink-soft)]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" aria-hidden />
            {r}
          </li>
        ))}
      </ul>

      {typeof walkMinutes === "number" && (
        <p className="mt-2 text-xs font-medium text-[var(--color-brand)]">~{walkMinutes} min walk away</p>
      )}

      {explanation.caveats.length > 0 && (
        <p className="mt-2 text-xs text-[var(--color-ink-soft)]">{explanation.caveats[0]}</p>
      )}

      <div className="mt-auto pt-3">
        <Button className="w-full" onClick={() => onRequest(resource)}>
          Request this
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </Card>
  );
}
