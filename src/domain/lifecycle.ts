/**
 * Explicit state machines for resources and requests (FR-9, FR-12).
 * Transitions are validated here and enforced server-side. Illegal
 * transitions are rejected (callers map to HTTP 409).
 */
import { AvailabilityStatus, RequestStatus } from "./types";

// ---------------------------------------------------------------------------
// Request lifecycle: PENDING -> ACCEPTED -> COMPLETED, plus DECLINED/CANCELLED.
// ---------------------------------------------------------------------------

export type RequestAction =
  | "ACCEPT"
  | "DECLINE"
  | "CANCEL"
  | "COMPLETE";

const REQUEST_TRANSITIONS: Record<RequestStatus, Partial<Record<RequestAction, RequestStatus>>> = {
  [RequestStatus.PENDING]: {
    ACCEPT: RequestStatus.ACCEPTED,
    DECLINE: RequestStatus.DECLINED,
    CANCEL: RequestStatus.CANCELLED,
  },
  [RequestStatus.ACCEPTED]: {
    COMPLETE: RequestStatus.COMPLETED,
    CANCEL: RequestStatus.CANCELLED,
  },
  [RequestStatus.DECLINED]: {},
  [RequestStatus.CANCELLED]: {},
  [RequestStatus.COMPLETED]: {
    // Idempotent completion: completing an already-completed request is a no-op.
    COMPLETE: RequestStatus.COMPLETED,
  },
};

export function canTransitionRequest(from: RequestStatus, action: RequestAction): boolean {
  return REQUEST_TRANSITIONS[from]?.[action] != null;
}

export function nextRequestStatus(from: RequestStatus, action: RequestAction): RequestStatus {
  const to = REQUEST_TRANSITIONS[from]?.[action];
  if (to == null) {
    throw new LifecycleError(`Illegal request transition: ${from} -(${action})-> ?`);
  }
  return to;
}

// ---------------------------------------------------------------------------
// Resource lifecycle:
//   AVAILABLE <-> RESERVED/UNAVAILABLE, RESERVED -> BORROWED -> AVAILABLE, ARCHIVED (terminal-ish)
// ---------------------------------------------------------------------------

const RESOURCE_TRANSITIONS: Record<AvailabilityStatus, AvailabilityStatus[]> = {
  [AvailabilityStatus.AVAILABLE]: [
    AvailabilityStatus.RESERVED,
    AvailabilityStatus.BORROWED,
    AvailabilityStatus.UNAVAILABLE,
    AvailabilityStatus.ARCHIVED,
  ],
  [AvailabilityStatus.RESERVED]: [
    AvailabilityStatus.AVAILABLE,
    AvailabilityStatus.BORROWED,
    AvailabilityStatus.UNAVAILABLE,
  ],
  [AvailabilityStatus.BORROWED]: [
    AvailabilityStatus.AVAILABLE,
    AvailabilityStatus.UNAVAILABLE,
  ],
  [AvailabilityStatus.UNAVAILABLE]: [
    AvailabilityStatus.AVAILABLE,
    AvailabilityStatus.ARCHIVED,
  ],
  [AvailabilityStatus.ARCHIVED]: [],
};

export function canTransitionResource(
  from: AvailabilityStatus,
  to: AvailabilityStatus,
): boolean {
  if (from === to) return true; // idempotent self-transition allowed
  return RESOURCE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertResourceTransition(
  from: AvailabilityStatus,
  to: AvailabilityStatus,
): void {
  if (!canTransitionResource(from, to)) {
    throw new LifecycleError(`Illegal resource transition: ${from} -> ${to}`);
  }
}

export class LifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LifecycleError";
  }
}

/**
 * When an exclusive request is ACCEPTED, the resource becomes RESERVED.
 * When COMPLETED, the resource returns to AVAILABLE. DECLINE/CANCEL of a
 * previously-accepted exclusive request also frees the resource.
 */
export function resourceStatusForRequestAction(
  action: RequestAction,
  exclusive: boolean,
  priorRequestStatus: RequestStatus,
): AvailabilityStatus | null {
  if (!exclusive) return null; // non-exclusive resources don't change state
  switch (action) {
    case "ACCEPT":
      return AvailabilityStatus.RESERVED;
    case "COMPLETE":
      return AvailabilityStatus.AVAILABLE;
    case "DECLINE":
      return priorRequestStatus === RequestStatus.ACCEPTED
        ? AvailabilityStatus.AVAILABLE
        : null;
    case "CANCEL":
      return priorRequestStatus === RequestStatus.ACCEPTED
        ? AvailabilityStatus.AVAILABLE
        : null;
    default:
      return null;
  }
}
