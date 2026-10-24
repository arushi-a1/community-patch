import { cn } from "./cn";

// Deterministic warm palette for avatar backgrounds (sage/clay family).
const PALETTE = [
  { bg: "#e7ecda", fg: "#4a5b3c" }, // sage
  { bg: "#f3dde4", fg: "#8a3457" }, // berry
  { bg: "#f1e6cc", fg: "#8a6318" }, // honey
  { bg: "#e3e3d0", fg: "#555a3f" }, // moss-grey
  { bg: "#ece0ce", fg: "#6b5a3f" }, // sand
  { bg: "#e0e9e2", fg: "#3f5a49" }, // eucalyptus
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const SIZES = { sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-xl" };

export function Avatar({
  name,
  seed,
  size = "md",
  className,
}: {
  name: string;
  /** Stable seed (e.g. user id) so the color doesn't change with display name. */
  seed?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const color = PALETTE[hash(seed ?? name) % PALETTE.length]!;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", SIZES[size], className)}
      style={{ background: color.bg, color: color.fg }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
