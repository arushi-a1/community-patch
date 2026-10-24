"use client";
import { useState } from "react";
import { PublicResource } from "@/domain/types";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/components/lib/api";

export function RequestDialog({
  resource,
  open,
  onClose,
  onCreated,
}: {
  resource: PublicResource;
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const toast = useToast();
  const [pickupContext, setPickupContext] = useState("");
  const [message, setMessage] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.createRequest({
        resourceId: resource.id,
        pickupContext,
        message,
        requestedTime: requestedTime ? new Date(requestedTime).toISOString() : undefined,
      });
      toast.success("Request sent. You'll be notified when the owner responds.");
      onClose();
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Request "${resource.title}"`}
      description="Your request is sent to the owner. It isn't confirmed until they accept."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Send request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="When do you need it?" htmlFor="rt" hint="Optional. Helps the owner plan.">
          <Input
            id="rt"
            type="datetime-local"
            value={requestedTime}
            onChange={(e) => setRequestedTime(e.target.value)}
          />
        </Field>
        <Field label="Pickup context" htmlFor="pc" hint="Where will you be? Any helpful detail.">
          <Input
            id="pc"
            value={pickupContext}
            maxLength={400}
            onChange={(e) => setPickupContext(e.target.value)}
            placeholder="e.g. I'll be at the Student Union entrance"
          />
        </Field>
        <Field label="Message to owner" htmlFor="msg">
          <Textarea
            id="msg"
            value={message}
            maxLength={600}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="A short, friendly note"
          />
        </Field>
      </div>
    </Dialog>
  );
}
