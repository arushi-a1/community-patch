"use client";
import { useEffect, useState } from "react";
import { MapPin, Lock } from "lucide-react";
import { PublicResource, Request, RequestStatus } from "@/domain/types";
import { api } from "@/components/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useCelebration } from "@/components/ui/Celebration";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { MessageButton } from "@/components/messages/MessageButton";
import { REQUEST_STATUS_LABELS, requestStatusTone, relativeTime } from "@/components/lib/labels";

export function RequestRow({
  request,
  perspective,
  onChanged,
}: {
  request: Request;
  perspective: "owner" | "requester";
  onChanged: () => void;
}) {
  const toast = useToast();
  const { celebrate } = useCelebration();
  const [resource, setResource] = useState<PublicResource | null>(null);
  const [pickup, setPickup] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "decline" | "cancel">(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getRequest(request.id)
      .then((r) => {
        if (cancelled) return;
        setResource(r.resource);
        setPickup(r.pickupInstructions);
      })
      .catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, [request.id, request.status]);

  const act = async (action: "accept" | "decline" | "cancel" | "complete") => {
    setBusy(true);
    try {
      await api.requestAction(request.id, action);
      const verb =
        action === "accept" ? "accepted" : action === "decline" ? "declined" : action === "cancel" ? "cancelled" : "completed";
      toast.success(`Request ${verb}.`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const title = resource?.title ?? "Resource";
  const counterpart = perspective === "owner" ? "Requester" : resource?.ownerDisplayName ?? "Owner";

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--color-ink)]">{title}</span>
            <Badge tone={requestStatusTone(request.status)}>{REQUEST_STATUS_LABELS[request.status]}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
            {perspective === "owner" ? "Incoming" : "Outgoing"} · {counterpart} · created {relativeTime(request.createdAt)}
          </p>
          {request.message && (
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">&ldquo;{request.message}&rdquo;</p>
          )}
          {request.pickupContext && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-ink-soft)]">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {request.pickupContext}
            </p>
          )}
          {request.status === RequestStatus.ACCEPTED && pickup && (
            <p className="mt-2 inline-flex items-start gap-1.5 rounded-[var(--radius-control)] bg-[var(--color-accent-weak)] px-2.5 py-1.5 text-xs text-[var(--color-brand)]">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Pickup: {pickup}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {perspective === "owner" && request.status === RequestStatus.PENDING && (
            <>
              <Button size="sm" onClick={() => act("accept")} loading={busy}>
                Accept
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirm("decline")} disabled={busy}>
                Decline
              </Button>
            </>
          )}
          {request.status === RequestStatus.ACCEPTED && (
            <>
              <MessageButton contextType="RESOURCE_REQUEST" contextId={request.id} />
              <Button
                size="sm"
                onClick={async () => {
                  await act("complete");
                  // The lender earns points on completion; celebrate for them.
                  if (perspective === "owner") {
                    celebrate({ title: "Exchange complete!", subtitle: "+15 PATCH Points" });
                  } else {
                    celebrate({ title: "All wrapped up!", subtitle: "Thanks for keeping it in the community" });
                  }
                }}
                loading={busy}
              >
                Mark complete
              </Button>
            </>
          )}
          {(request.status === RequestStatus.PENDING || request.status === RequestStatus.ACCEPTED) && (
            <Button size="sm" variant="ghost" onClick={() => setConfirm("cancel")} disabled={busy}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "decline" ? "Decline this request?" : "Cancel this request?"}
        description={
          confirm === "decline"
            ? "The requester will be notified. This can't be undone."
            : "This will withdraw the request. This can't be undone."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="danger" loading={busy} onClick={() => act(confirm === "decline" ? "decline" : "cancel")}>
              {confirm === "decline" ? "Decline" : "Cancel request"}
            </Button>
          </>
        }
      />
    </Card>
  );
}
