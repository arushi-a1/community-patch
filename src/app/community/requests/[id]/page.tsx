"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  HandHeart,
  MapPin,
  Clock,
  CheckCircle2,
  HelpingHand,
} from "lucide-react";
import { PublicCommunityRequest } from "@/domain/types";
import { api } from "@/components/lib/api";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { useCelebration } from "@/components/ui/Celebration";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { MessageButton } from "@/components/messages/MessageButton";
import { UserLink } from "@/components/community/UserLink";
import { CATEGORY_LABELS, relativeTime } from "@/components/lib/labels";
import { cn } from "@/components/ui/cn";

interface OfferView {
  id: string;
  helperId: string;
  helperName: string;
  message: string;
  status: string;
  mine: boolean;
  createdAt: string;
}

const STATUS_TONE: Record<string, "accent" | "amber" | "muted" | "danger"> = {
  OPEN: "amber",
  MATCHED: "accent",
  RESOLVED: "muted",
  CANCELLED: "danger",
  EXPIRED: "muted",
};

export default function CommunityRequestDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { actorId } = useSession();
  const toast = useToast();
  const { celebrate } = useCelebration();

  const [request, setRequest] = useState<PublicCommunityRequest | null>(null);
  const [offers, setOffers] = useState<OfferView[]>([]);
  const [isRequester, setIsRequester] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offerMsg, setOfferMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.getCommunityRequest(id);
      setRequest(r.request);
      setOffers(r.offers);
      setIsRequester(r.isRequester);
    } catch {
      toast.error("Couldn't load this request.");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load, actorId]);

  const myOffer = offers.find((o) => o.mine);
  const canOffer = !isRequester && request && (request.status === "OPEN" || request.status === "MATCHED") && !myOffer;

  const act = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!request) {
    return <p className="text-[var(--color-ink-soft)]">This request couldn&apos;t be found.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/community" className="inline-flex w-fit items-center gap-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Community
      </Link>

      <Card className="p-5 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Needs help</Badge>
          <Badge tone={STATUS_TONE[request.status] ?? "muted"}>{request.status}</Badge>
          <Badge tone="muted">{CATEGORY_LABELS[request.category]}</Badge>
          {request.urgency === "CRITICAL" && <Badge tone="danger">Urgent</Badge>}
        </div>
        <h1 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
          {request.quantity > 1 ? `${request.quantity} × ` : ""}
          {request.title}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-ink-soft)]">
          Posted by <UserLink userId={request.requesterId} name={request.requesterDisplayName} /> ·{" "}
          {relativeTime(request.createdAt)}
        </p>
        {request.description && (
          <p className="mt-3 text-[var(--color-ink-soft)]">{request.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink-soft)]">
          {request.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> Near {request.location.zone}
            </span>
          )}
          {request.deadline && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden /> Needed {relativeTime(request.deadline)}
            </span>
          )}
        </div>
      </Card>

      {/* Offer to help (non-requesters) */}
      {canOffer && (
        <Card className="p-5">
          <h2 className="font-semibold text-[var(--color-ink)]">Can you help?</h2>
          <p className="mt-0.5 text-sm text-[var(--color-ink-soft)]">
            Offer to bring this or lend a hand. {request.requesterDisplayName} will be notified.
          </p>
          <Textarea
            className="mt-3"
            value={offerMsg}
            onChange={(e) => setOfferMsg(e.target.value)}
            maxLength={600}
            placeholder="e.g. I've got a spare — I can meet you at the library in 5 min."
          />
          <div className="mt-3 flex justify-end">
            <Button
              loading={busy}
              onClick={() => act(() => api.offerHelp(id, { message: offerMsg }), "Offer sent!")}
            >
              <HandHeart className="h-4 w-4" aria-hidden /> Offer to help
            </Button>
          </div>
        </Card>
      )}

      {myOffer && !isRequester && (
        <Card className="flex flex-wrap items-center gap-3 border-l-4 border-[var(--color-accent)] p-4">
          <CheckCircle2 className="h-5 w-5 text-[var(--color-accent)]" aria-hidden />
          <p className="flex-1 text-sm text-[var(--color-ink)]">
            You offered to help ({myOffer.status.toLowerCase()}).{" "}
            {myOffer.status === "ACCEPTED" && "Coordinate the handoff in Messages."}
          </p>
          {myOffer.status === "ACCEPTED" && (
            <MessageButton contextType="COMMUNITY_REQUEST" contextId={id} label="Message requester" />
          )}
        </Card>
      )}

      {/* Requester: once matched, message the accepted helper */}
      {isRequester && request.status === "MATCHED" && (
        <Card className="flex flex-wrap items-center gap-3 border-l-4 border-[var(--color-accent)] p-4">
          <CheckCircle2 className="h-5 w-5 text-[var(--color-accent)]" aria-hidden />
          <p className="flex-1 text-sm text-[var(--color-ink)]">
            You&apos;ve matched with a helper. Coordinate the handoff in Messages.
          </p>
          <MessageButton contextType="COMMUNITY_REQUEST" contextId={id} label="Message helper" />
        </Card>
      )}

      {/* Offers list (requester view) */}
      {isRequester && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
              Offers ({offers.length})
            </h2>
            {(request.status === "OPEN" || request.status === "MATCHED") && (
              <Button
                variant="ghost"
                size="sm"
                loading={busy}
                onClick={() =>
                  act(async () => {
                    await api.resolveCommunityRequest(id);
                    if (request.status === "MATCHED") {
                      celebrate({
                        title: "Request resolved!",
                        subtitle: "+25 PATCH Points for your helper",
                      });
                    }
                  }, "Marked resolved 🎉")
                }
              >
                Mark resolved
              </Button>
            )}
          </div>

          {offers.length === 0 ? (
            <Card className="p-6 text-center text-sm text-[var(--color-ink-soft)]">
              No offers yet. Neighbors nearby have been notified — hang tight.
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {offers.map((o) => (
                <Card key={o.id} className={cn("p-4", o.status === "ACCEPTED" && "border-l-4 border-[var(--color-accent)]")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <UserLink userId={o.helperId} name={o.helperName} withAvatar />
                        <Badge tone={o.status === "ACCEPTED" ? "accent" : o.status === "DECLINED" ? "danger" : "amber"}>
                          {o.status}
                        </Badge>
                      </div>
                      {o.message && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">&ldquo;{o.message}&rdquo;</p>}
                      <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{relativeTime(o.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <MessageButton
                        contextType="COMMUNITY_REQUEST"
                        contextId={id}
                        counterpartId={o.helperId}
                        label="Message"
                        variant="ghost"
                      />
                      {o.status === "PENDING" && request.status === "OPEN" && (
                        <>
                          <Button size="sm" loading={busy} onClick={() => act(() => api.acceptOffer(o.id), `Accepted ${o.helperName}'s offer`)}>
                            Accept
                          </Button>
                          <Button size="sm" variant="secondary" loading={busy} onClick={() => act(() => api.declineOffer(o.id), "Offer declined")}>
                            Decline
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {!isRequester && !canOffer && !myOffer && (
        <Card className="flex items-center gap-3 p-4 text-sm text-[var(--color-ink-soft)]">
          <HelpingHand className="h-5 w-5 text-[var(--color-ink-soft)]" aria-hidden />
          This request is {request.status.toLowerCase()} and isn&apos;t taking new offers.
        </Card>
      )}
    </div>
  );
}
