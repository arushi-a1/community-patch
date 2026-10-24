import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/components/ui/cn";

/**
 * A community member's name (optionally with avatar) linking to their public
 * profile. Used everywhere a display name appears so the community feels
 * connected. When `userId` is unknown, renders plain text (no dead link).
 */
export function UserLink({
  userId,
  name,
  withAvatar = false,
  avatarSize = "sm",
  className,
}: {
  userId?: string;
  name: string;
  withAvatar?: boolean;
  avatarSize?: "sm" | "md" | "lg";
  className?: string;
}) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {withAvatar && <Avatar name={name} seed={userId ?? name} size={avatarSize} />}
      <span className="font-medium">{name}</span>
    </span>
  );

  if (!userId) return content;

  return (
    <Link
      href={`/u/${userId}`}
      className="inline-flex items-center gap-2 rounded-md text-[var(--color-ink)] transition-colors hover:text-[var(--color-brand)] hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {withAvatar && <Avatar name={name} seed={userId} size={avatarSize} />}
      <span className="font-medium">{name}</span>
    </Link>
  );
}
