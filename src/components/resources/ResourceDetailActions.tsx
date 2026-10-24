"use client";
import { useState } from "react";
import Link from "next/link";
import { Handshake, Pencil } from "lucide-react";
import { PublicResource, AvailabilityStatus } from "@/domain/types";
import { Button } from "@/components/ui/Button";
import { RequestDialog } from "@/components/requests/RequestDialog";
import { useSession } from "@/components/providers/SessionProvider";

export function ResourceDetailActions({ resource }: { resource: PublicResource }) {
  const [open, setOpen] = useState(false);
  const { actorId } = useSession();

  const isOwner = actorId === resource.ownerId;
  const available = resource.availabilityStatus === AvailabilityStatus.AVAILABLE;

  if (isOwner) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-[var(--radius-control)] bg-[var(--color-brand-weak)] px-3 py-2 text-sm text-[var(--color-brand)]">
          This is your resource.
        </p>
        <Link href={`/resources/${resource.id}/edit`}>
          <Button variant="secondary" className="w-full">
            <Pencil className="h-4 w-4" aria-hidden />
            Edit resource
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <Button size="lg" disabled={!available} onClick={() => setOpen(true)}>
        <Handshake className="h-4 w-4" aria-hidden />
        {available ? "Request this" : "Not available right now"}
      </Button>
      {open && (
        <RequestDialog resource={resource} open={open} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
