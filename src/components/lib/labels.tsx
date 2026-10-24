import {
  Battery,
  Calculator,
  Cable,
  HandHelping,
  Hammer,
  CookingPot,
  PanelsTopLeft,
  Umbrella,
  Boxes,
  HelpCircle,
  Plug,
  type LucideIcon,
} from "lucide-react";
import { AvailabilityStatus, Category, RequestStatus } from "@/domain/types";

export const CATEGORY_LABELS: Record<Category, string> = {
  ELECTRONICS_ADAPTERS: "Electronics & adapters",
  CHARGERS_BATTERIES: "Chargers & batteries",
  SCHOOL_SUPPLIES: "School supplies",
  TOOLS_REPAIR: "Tools & repair",
  KITCHEN_HOUSEHOLD: "Kitchen & household",
  EVENT_EQUIPMENT: "Event equipment",
  OUTDOOR_WEATHER: "Outdoor & weather",
  MOVING_PHYSICAL: "Moving & physical help",
  OTHER_HELP: "Other community help",
};

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  ELECTRONICS_ADAPTERS: Plug,
  CHARGERS_BATTERIES: Battery,
  SCHOOL_SUPPLIES: Calculator,
  TOOLS_REPAIR: Hammer,
  KITCHEN_HOUSEHOLD: CookingPot,
  EVENT_EQUIPMENT: PanelsTopLeft,
  OUTDOOR_WEATHER: Umbrella,
  MOVING_PHYSICAL: Boxes,
  OTHER_HELP: HelpCircle,
};

export const CABLE_ICON = Cable;
export const HELP_ICON = HandHelping;

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  AVAILABLE: "Available now",
  RESERVED: "Reserved",
  BORROWED: "Borrowed",
  UNAVAILABLE: "Unavailable",
  ARCHIVED: "Archived",
};

export function availabilityTone(status: AvailabilityStatus): "accent" | "amber" | "muted" {
  if (status === "AVAILABLE") return "accent";
  if (status === "RESERVED" || status === "BORROWED") return "amber";
  return "muted";
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

export function requestStatusTone(status: RequestStatus): "accent" | "amber" | "danger" | "muted" {
  switch (status) {
    case "ACCEPTED":
      return "accent";
    case "PENDING":
      return "amber";
    case "DECLINED":
    case "CANCELLED":
      return "danger";
    default:
      return "muted";
  }
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(mins / 60);
  const days = Math.round(hrs / 24);
  const suffix = diffMs >= 0 ? "from now" : "ago";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ${suffix}`;
  if (hrs < 24) return `${hrs} hr ${suffix}`;
  return `${days} day${days === 1 ? "" : "s"} ${suffix}`;
}

export function categoryColor(category: Category): string {
  // Cohesive sage/clay placeholder backgrounds — all in the earthy family,
  // gentle variations so cards have subtle variety without clashing.
  const map: Partial<Record<Category, string>> = {
    ELECTRONICS_ADAPTERS: "#e7ecda", // sage
    CHARGERS_BATTERIES: "#f1e6cc", // honey
    SCHOOL_SUPPLIES: "#ece7d3", // oat
    TOOLS_REPAIR: "#e3e3d0", // moss-grey
    KITCHEN_HOUSEHOLD: "#f3e2da", // clay-rose
    EVENT_EQUIPMENT: "#e9efdd", // light sage
    OUTDOOR_WEATHER: "#e6ecd8", // sage
    MOVING_PHYSICAL: "#eee7d6", // sand
    OTHER_HELP: "#f1e8d6", // cream-oat
  };
  return map[category] ?? "#eef0e2";
}
