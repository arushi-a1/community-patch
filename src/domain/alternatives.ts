/**
 * Grounded alternative generation (FR-8). When the exact requested item is
 * unavailable/incompatible, suggest outcome-equivalent options — but ONLY from
 * resources the application actually retrieved, and only after checking
 * compatibility + availability. A model-generated item name is never proof the
 * item exists; we re-ground every suggestion against real rows.
 */
import { AvailabilityStatus, Alternative, PublicResource } from "./types";
import { Interpretation } from "./interpretation";
import { checkCompatibility } from "./matching";

function capabilityMatch(r: PublicResource, interp: Interpretation): boolean {
  const caps = interp.required_capabilities.map((c) => c.toLowerCase());
  if (caps.length === 0) return false;
  const hay = (r.title + " " + r.description + " " + r.tags.join(" ")).toLowerCase();
  return caps.some((c) => c.length > 0 && hay.includes(c));
}

/**
 * Given the full candidate set and the primary matches already chosen, derive
 * viable alternatives from the retrieved rows.
 */
export function deriveAlternatives(
  candidates: PublicResource[],
  primaryIds: Set<string>,
  interp: Interpretation,
  opts: { max?: number } = {},
): Alternative[] {
  const max = opts.max ?? 3;
  const out: Alternative[] = [];

  const need = interp.compatibility_constraints;
  const wantsUsbcToHdmi =
    !!need.sourcePorts?.includes("USB_C") && !!need.sinkPorts?.includes("HDMI");

  for (const r of candidates) {
    if (primaryIds.has(r.id)) continue;
    if (out.length >= max) break;

    // Only surface things that are at least knowable as available or available-later.
    const available = r.availabilityStatus === AvailabilityStatus.AVAILABLE;
    const availableLater =
      r.availabilityStatus === AvailabilityStatus.RESERVED &&
      r.availabilityWindows.length > 0;

    if (!available && !availableLater) continue;

    // Re-ground: the alternative must still satisfy the compatibility need.
    const compat = checkCompatibility(r, interp);
    if (!compat.ok) continue;

    let rationale: string | undefined;

    if (wantsUsbcToHdmi && /hub/i.test(r.title + " " + r.tags.join(" "))) {
      rationale = "A USB-C hub with HDMI output achieves the same connection.";
    } else if (
      (need.sinkPorts?.length ?? 0) > 0 &&
      r.compatibility.sinkPorts.some((p) => need.sinkPorts!.includes(p))
    ) {
      rationale = `Also provides ${need.sinkPorts!.join("/")}, so it can solve the same problem a different way.`;
    } else if (capabilityMatch(r, interp)) {
      rationale = "Covers the same underlying need a different way.";
    }

    if (!rationale) continue;

    out.push({
      resource: r,
      rationale,
      needsConfirmation: !available, // available-later needs confirmation
    });
  }

  return out;
}
