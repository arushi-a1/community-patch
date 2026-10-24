"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/components/lib/api";

/**
 * Opens (or creates) the conversation for a context and navigates to it.
 */
export function MessageButton({
  contextType,
  contextId,
  counterpartId,
  label = "Message",
  variant = "secondary",
  size = "sm",
}: {
  contextType: "RESOURCE_REQUEST" | "COMMUNITY_REQUEST";
  contextId: string;
  counterpartId?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      const convo = await api.openConversation(contextType, contextId, counterpartId);
      router.push(`/messages/${convo.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the conversation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant={variant} size={size} loading={busy} onClick={open}>
      <MessageCircle className="h-4 w-4" aria-hidden />
      {label}
    </Button>
  );
}
