import { describe, it, expect } from "vitest";
import {
  canModifyResource,
  canCreateRequest,
  canViewRequest,
  canActOnRequest,
  canSeePickupInstructions,
  Actor,
} from "../authz";
import { RequestStatus } from "../types";
import { makeFullResource, makeRequest } from "./helpers";

const owner: Actor = { userId: "user-owner", communityId: "campus-demo" };
const borrower: Actor = { userId: "user-borrower", communityId: "campus-demo" };
const stranger: Actor = { userId: "user-x", communityId: "campus-demo" };

describe("canModifyResource", () => {
  it("allows the owner", () => {
    expect(canModifyResource(owner, makeFullResource()).allowed).toBe(true);
  });
  it("denies a non-owner", () => {
    expect(canModifyResource(borrower, makeFullResource()).allowed).toBe(false);
  });
});

describe("canCreateRequest", () => {
  it("allows a non-owner borrower", () => {
    expect(canCreateRequest(borrower, makeFullResource()).allowed).toBe(true);
  });
  it("denies the owner borrowing their own exclusive item", () => {
    expect(canCreateRequest(owner, makeFullResource({ exclusive: true })).allowed).toBe(false);
  });
});

describe("canViewRequest", () => {
  const req = makeRequest();
  it("allows requester and owner", () => {
    expect(canViewRequest(owner, req).allowed).toBe(true);
    expect(canViewRequest(borrower, req).allowed).toBe(true);
  });
  it("denies a stranger", () => {
    expect(canViewRequest(stranger, req).allowed).toBe(false);
  });
});

describe("canActOnRequest", () => {
  const req = makeRequest();
  it("only the owner can accept or decline", () => {
    expect(canActOnRequest(owner, req, "ACCEPT").allowed).toBe(true);
    expect(canActOnRequest(borrower, req, "ACCEPT").allowed).toBe(false);
    expect(canActOnRequest(borrower, req, "DECLINE").allowed).toBe(false);
  });
  it("either participant can cancel", () => {
    expect(canActOnRequest(owner, req, "CANCEL").allowed).toBe(true);
    expect(canActOnRequest(borrower, req, "CANCEL").allowed).toBe(true);
    expect(canActOnRequest(stranger, req, "CANCEL").allowed).toBe(false);
  });
});

describe("canSeePickupInstructions", () => {
  it("hides pickup until accepted", () => {
    const pending = makeRequest({ status: RequestStatus.PENDING });
    expect(canSeePickupInstructions(borrower, pending)).toBe(false);
  });
  it("shows pickup to participants once accepted", () => {
    const accepted = makeRequest({ status: RequestStatus.ACCEPTED });
    expect(canSeePickupInstructions(borrower, accepted)).toBe(true);
    expect(canSeePickupInstructions(owner, accepted)).toBe(true);
  });
  it("never shows pickup to a stranger", () => {
    const accepted = makeRequest({ status: RequestStatus.ACCEPTED });
    expect(canSeePickupInstructions(stranger, accepted)).toBe(false);
  });
});
