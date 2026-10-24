import { describe, it, expect } from "vitest";
import {
  canTransitionRequest,
  nextRequestStatus,
  canTransitionResource,
  assertResourceTransition,
  resourceStatusForRequestAction,
  LifecycleError,
} from "../lifecycle";
import { AvailabilityStatus, RequestStatus } from "../types";

describe("request lifecycle", () => {
  it("allows PENDING -> ACCEPTED", () => {
    expect(canTransitionRequest(RequestStatus.PENDING, "ACCEPT")).toBe(true);
    expect(nextRequestStatus(RequestStatus.PENDING, "ACCEPT")).toBe(RequestStatus.ACCEPTED);
  });

  it("allows ACCEPTED -> COMPLETED", () => {
    expect(nextRequestStatus(RequestStatus.ACCEPTED, "COMPLETE")).toBe(RequestStatus.COMPLETED);
  });

  it("forbids completing a PENDING request", () => {
    expect(canTransitionRequest(RequestStatus.PENDING, "COMPLETE")).toBe(false);
    expect(() => nextRequestStatus(RequestStatus.PENDING, "COMPLETE")).toThrow(LifecycleError);
  });

  it("forbids accepting a DECLINED request", () => {
    expect(canTransitionRequest(RequestStatus.DECLINED, "ACCEPT")).toBe(false);
  });

  it("is idempotent when completing an already completed request", () => {
    expect(nextRequestStatus(RequestStatus.COMPLETED, "COMPLETE")).toBe(RequestStatus.COMPLETED);
  });
});

describe("resource lifecycle", () => {
  it("allows AVAILABLE -> RESERVED", () => {
    expect(canTransitionResource(AvailabilityStatus.AVAILABLE, AvailabilityStatus.RESERVED)).toBe(true);
  });

  it("forbids ARCHIVED -> AVAILABLE", () => {
    expect(canTransitionResource(AvailabilityStatus.ARCHIVED, AvailabilityStatus.AVAILABLE)).toBe(false);
    expect(() =>
      assertResourceTransition(AvailabilityStatus.ARCHIVED, AvailabilityStatus.AVAILABLE),
    ).toThrow(LifecycleError);
  });

  it("allows idempotent self-transition", () => {
    expect(canTransitionResource(AvailabilityStatus.AVAILABLE, AvailabilityStatus.AVAILABLE)).toBe(true);
  });
});

describe("resourceStatusForRequestAction", () => {
  it("reserves an exclusive resource on accept", () => {
    expect(resourceStatusForRequestAction("ACCEPT", true, RequestStatus.PENDING)).toBe(
      AvailabilityStatus.RESERVED,
    );
  });

  it("frees an exclusive resource on complete", () => {
    expect(resourceStatusForRequestAction("COMPLETE", true, RequestStatus.ACCEPTED)).toBe(
      AvailabilityStatus.AVAILABLE,
    );
  });

  it("frees the resource when an accepted request is cancelled", () => {
    expect(resourceStatusForRequestAction("CANCEL", true, RequestStatus.ACCEPTED)).toBe(
      AvailabilityStatus.AVAILABLE,
    );
  });

  it("does not change state when a pending request is cancelled", () => {
    expect(resourceStatusForRequestAction("CANCEL", true, RequestStatus.PENDING)).toBeNull();
  });

  it("never changes state for non-exclusive resources", () => {
    expect(resourceStatusForRequestAction("ACCEPT", false, RequestStatus.PENDING)).toBeNull();
  });
});
