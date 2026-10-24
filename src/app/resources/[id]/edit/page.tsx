"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PublicResource } from "@/domain/types";
import { api } from "@/components/lib/api";
import { useSession } from "@/components/providers/SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { ResourceForm } from "@/components/resources/ResourceForm";
import { Skeleton } from "@/components/ui/Skeleton";

export default function EditResourcePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { actorId, loading: sessionLoading } = useSession();
  const [resource, setResource] = useState<PublicResource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getResource(id)
      .then(setResource)
      .catch(() => toast.error("Couldn't load that resource."))
      .finally(() => setLoading(false));
  }, [id, toast]);

  // Only the owner may edit; redirect others away once we know who they are.
  useEffect(() => {
    if (!loading && !sessionLoading && resource && actorId && resource.ownerId !== actorId) {
      toast.info("You can only edit resources you own.");
      router.replace(`/resources/${id}`);
    }
  }, [loading, sessionLoading, resource, actorId, id, router, toast]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!resource) {
    return <p className="text-[var(--color-ink-soft)]">This resource couldn&apos;t be found.</p>;
  }
  if (actorId && resource.ownerId !== actorId) {
    return null; // redirecting
  }

  return <ResourceForm existing={resource} />;
}
