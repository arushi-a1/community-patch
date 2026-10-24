import { describe, it, expect } from "vitest";
import {
  checkCompatibility,
  checkEligibility,
  rankResources,
  haversineKm,
  scoreResource,
} from "../matching";
import { analyzeProblemDeterministic } from "../interpretation";
import { AvailabilityStatus, Category, Port } from "../types";
import { makeResource, FIXED_NOW } from "./helpers";

const USBC_HDMI_TEXT =
  "Our event starts in 15 minutes in the student union. The presenter's laptop only has USB-C, and the projector uses HDMI. Connect them now.";

function interpUsbcHdmi() {
  return analyzeProblemDeterministic(USBC_HDMI_TEXT, { now: FIXED_NOW });
}

const REQUESTER_LOC = { label: "Student Union", zone: "Central", lat: 40.0, lng: -83.0 };

describe("haversineKm", () => {
  it("returns undefined without coordinates", () => {
    expect(haversineKm({ label: "a", zone: "z" }, { label: "b", zone: "z" })).toBeUndefined();
  });
  it("computes zero for identical points", () => {
    expect(haversineKm(REQUESTER_LOC, REQUESTER_LOC)).toBeCloseTo(0, 5);
  });
});

describe("checkCompatibility", () => {
  const interp = interpUsbcHdmi();

  it("passes a true USB-C -> HDMI adapter", () => {
    const r = makeResource({
      compatibility: { sourcePorts: [Port.USB_C], sinkPorts: [Port.HDMI], attributes: [] },
    });
    expect(checkCompatibility(r, interp).ok).toBe(true);
  });

  it("FAILS an HDMI-only cable for a USB-C source need", () => {
    const r = makeResource({
      title: "HDMI to HDMI cable",
      compatibility: { sourcePorts: [Port.HDMI], sinkPorts: [Port.HDMI], attributes: [] },
    });
    const res = checkCompatibility(r, interp);
    expect(res.ok).toBe(false);
  });

  it("disqualifies an exam-forbidden calculator in exam context", () => {
    const examInterp = analyzeProblemDeterministic(
      "I need a calculator for my exam this afternoon.",
      { now: FIXED_NOW },
    );
    const r = makeResource({
      title: "Graphing calculator",
      category: Category.SCHOOL_SUPPLIES,
      compatibility: { sourcePorts: [], sinkPorts: [], attributes: ["exam-permitted:false"] },
    });
    expect(checkCompatibility(r, examInterp).ok).toBe(false);
  });
});

describe("checkEligibility — hard constraints", () => {
  const interp = interpUsbcHdmi();
  const ctx = { interpretation: interp, requesterLocation: REQUESTER_LOC, requesterId: "user-borrower", now: FIXED_NOW };

  it("rejects a reserved resource even if compatible", () => {
    const r = makeResource({ availabilityStatus: AvailabilityStatus.RESERVED });
    const res = checkEligibility(r, ctx);
    expect(res.eligible).toBe(false);
    expect(res.reason).toMatch(/reserved/i);
  });

  it("rejects an incompatible resource", () => {
    const r = makeResource({
      compatibility: { sourcePorts: [Port.VGA], sinkPorts: [Port.VGA], attributes: [] },
    });
    expect(checkEligibility(r, ctx).eligible).toBe(false);
  });

  it("rejects the owner borrowing their own exclusive item", () => {
    const r = makeResource({ ownerId: "user-borrower" });
    const res = checkEligibility(r, ctx);
    expect(res.eligible).toBe(false);
    expect(res.reason).toMatch(/own/i);
  });

  it("rejects an item when assistance was requested", () => {
    const assistInterp = analyzeProblemDeterministic(
      "I need a pair of hands to carry boxes in 20 minutes.",
      { now: FIXED_NOW },
    );
    const r = makeResource(); // an ITEM
    const res = checkEligibility(r, { ...ctx, interpretation: assistInterp });
    expect(res.eligible).toBe(false);
  });

  it("rejects a resource beyond the radius", () => {
    const far = makeResource({ location: { label: "Far Hall", zone: "North", lat: 40.3, lng: -83.3 } });
    expect(checkEligibility(far, { ...ctx, radiusKm: 2.5 }).eligible).toBe(false);
  });

  it("accepts a compatible, available, nearby, in-time resource", () => {
    const r = makeResource();
    expect(checkEligibility(r, ctx).eligible).toBe(true);
  });
});

describe("rankResources — signature scenario", () => {
  const interp = interpUsbcHdmi();
  const ctx = { interpretation: interp, requesterLocation: REQUESTER_LOC, requesterId: "user-borrower", now: FIXED_NOW };

  const good = makeResource({ id: "good", title: "USB-C to HDMI adapter" });
  const reserved = makeResource({
    id: "reserved",
    title: "USB-C to HDMI adapter (reserved)",
    availabilityStatus: AvailabilityStatus.RESERVED,
  });
  const incompatible = makeResource({
    id: "hdmi-cable",
    title: "HDMI to HDMI cable",
    compatibility: { sourcePorts: [Port.HDMI], sinkPorts: [Port.HDMI], attributes: [] },
  });

  const result = rankResources([reserved, incompatible, good], ctx);

  it("returns the good adapter as the top match", () => {
    expect(result.matches[0]?.resource.id).toBe("good");
  });

  it("never offers the reserved adapter as a match", () => {
    expect(result.matches.find((m) => m.resource.id === "reserved")).toBeUndefined();
  });

  it("never offers the incompatible HDMI cable", () => {
    expect(result.matches.find((m) => m.resource.id === "hdmi-cable")).toBeUndefined();
  });

  it("records rejection reasons for honest messaging", () => {
    const ids = result.rejected.map((r) => r.resource.id);
    expect(ids).toContain("reserved");
    expect(ids).toContain("hdmi-cable");
  });

  it("includes a walk estimate when coordinates exist", () => {
    expect(result.matches[0]?.walkMinutes).toBeTypeOf("number");
  });

  it("grounds the explanation in real fields", () => {
    const reasons = result.matches[0]?.explanation.reasons.join(" ") ?? "";
    expect(reasons.toLowerCase()).toContain("available");
  });
});

describe("scoreResource weighting", () => {
  it("produces a normalized total in [0,1]", () => {
    const interp = interpUsbcHdmi();
    const score = scoreResource(makeResource(), {
      interpretation: interp,
      requesterLocation: REQUESTER_LOC,
      now: FIXED_NOW,
    });
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(1);
  });
});
