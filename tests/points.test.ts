import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalRepository } from "@/services/repository.local";
import { buildSeed } from "@/seed/data";
import { awardPoints, getUserPoints, getCommunityImpact } from "@/services/pointsService";
import { createRequest, actOnRequest } from "@/services/requestService";
import { createCommunityRequest, createOffer, acceptOffer, resolveCommunityRequest, cancelCommunityRequest } from "@/services/communityRequestService";
import { computeBadges } from "@/domain/points";
import { Actor } from "@/domain/authz";
import { Category } from "@/domain/types";

const priya: Actor = { userId: "user-priya", communityId: "campus-demo" };
const devin: Actor = { userId: "user-devin", communityId: "campus-demo" };
const maya: Actor = { userId: "user-maya", communityId: "campus-demo" };

async function freshRepo(): Promise<LocalRepository> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "patch-pts-"));
  const repo = new LocalRepository(dir);
  const s = buildSeed(new Date());
  await repo.loadSeed({
    users: Object.fromEntries(s.users.map((u) => [u.id, u])),
    resources: Object.fromEntries(s.resources.map((r) => [r.id, r])),
    requests: Object.fromEntries(s.requests.map((r) => [r.id, r])),
    communityRequests: Object.fromEntries(s.communityRequests.map((r) => [r.id, r])),
    offers: Object.fromEntries(s.offers.map((o) => [o.id, o])),
    notifications: {},
    conversations: {},
    messages: {},
    pointTransactions: {}, // start with an empty ledger for deterministic assertions
  });
  return repo;
}

describe("awardPoints — idempotency", () => {
  let repo: LocalRepository;
  beforeEach(async () => (repo = await freshRepo()));

  it("awards once and never double-awards the same event", async () => {
    const a = await awardPoints(repo, { communityId: "campus-demo", userId: "user-sam", eventType: "RESOURCE_LOAN_COMPLETED" as never, eventId: "evt-1" });
    const b = await awardPoints(repo, { communityId: "campus-demo", userId: "user-sam", eventType: "RESOURCE_LOAN_COMPLETED" as never, eventId: "evt-1" });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    const summary = await getUserPoints(repo, "user-sam");
    expect(summary.balance).toBe(15);
    expect(summary.contributionCount).toBe(1);
  });

  it("concurrent awards for the same event yield exactly one transaction", async () => {
    const [a, b] = await Promise.all([
      awardPoints(repo, { communityId: "campus-demo", userId: "user-sam", eventType: "RESOURCE_LOAN_COMPLETED" as never, eventId: "evt-cc" }),
      awardPoints(repo, { communityId: "campus-demo", userId: "user-sam", eventType: "RESOURCE_LOAN_COMPLETED" as never, eventId: "evt-cc" }),
    ]);
    const created = [a, b].filter((r) => r.created);
    expect(created.length).toBe(1);
    const summary = await getUserPoints(repo, "user-sam");
    expect(summary.balance).toBe(15);
  });
});

describe("points via the real request lifecycle", () => {
  it("completing a loan awards the LENDER exactly once (not on repeat complete)", async () => {
    const repo = await freshRepo();
    const created = await createRequest(repo, devin, { resourceId: "res-usbc-hdmi-1" }); // owner = priya
    if (!created.ok) throw new Error("setup");
    await actOnRequest(repo, priya, created.value.id, "ACCEPT");
    await actOnRequest(repo, priya, created.value.id, "COMPLETE");
    await actOnRequest(repo, priya, created.value.id, "COMPLETE"); // idempotent no-op

    const owner = await getUserPoints(repo, "user-priya");
    expect(owner.balance).toBe(15);
    expect(owner.contributionCount).toBe(1);
    // The borrower earns nothing for borrowing.
    const borrower = await getUserPoints(repo, "user-devin");
    expect(borrower.balance).toBe(0);
  });

  it("a cancelled request awards no points", async () => {
    const repo = await freshRepo();
    const created = await createRequest(repo, devin, { resourceId: "res-folding-table" }); // owner = maya
    if (!created.ok) throw new Error("setup");
    await actOnRequest(repo, maya, created.value.id, "DECLINE");
    const owner = await getUserPoints(repo, "user-maya");
    expect(owner.balance).toBe(0);
  });

  it("resolving a community request awards the HELPER 25, once", async () => {
    const repo = await freshRepo();
    const cr = await createCommunityRequest(repo, devin, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!cr.ok) throw new Error("setup");
    const offer = await createOffer(repo, maya, cr.value.id, {}); // maya helps
    if (!offer.ok) throw new Error("setup");
    await acceptOffer(repo, devin, offer.value.id);
    await resolveCommunityRequest(repo, devin, cr.value.id);
    await resolveCommunityRequest(repo, devin, cr.value.id); // idempotent

    const helper = await getUserPoints(repo, "user-maya");
    expect(helper.balance).toBe(25);
    expect(helper.contributionCount).toBe(1);
    // Requester earns nothing.
    const requester = await getUserPoints(repo, "user-devin");
    expect(requester.balance).toBe(0);
  });

  it("cancelling a community request in good faith awards nothing", async () => {
    const repo = await freshRepo();
    const cr = await createCommunityRequest(repo, devin, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!cr.ok) throw new Error("setup");
    await cancelCommunityRequest(repo, devin, cr.value.id);
    const summary = await getUserPoints(repo, "user-devin");
    expect(summary.balance).toBe(0);
  });
});

describe("badges + community impact", () => {
  it("unlocks badges only at their thresholds", () => {
    const at0 = computeBadges(0);
    expect(at0.find((b) => b.badge.id === "first-helping-hand")?.earned).toBe(false);
    const at1 = computeBadges(1);
    expect(at1.find((b) => b.badge.id === "first-helping-hand")?.earned).toBe(true);
    expect(at1.find((b) => b.badge.id === "resource-sharer")?.earned).toBe(false);
    const at5 = computeBadges(5);
    expect(at5.find((b) => b.badge.id === "community-helper")?.earned).toBe(true);
  });

  it("community impact sums only positive contributions from real transactions", async () => {
    const repo = await freshRepo();
    await awardPoints(repo, { communityId: "campus-demo", userId: "user-sam", eventType: "RESOURCE_LOAN_COMPLETED" as never, eventId: "e1" });
    await awardPoints(repo, { communityId: "campus-demo", userId: "user-omar", eventType: "COMMUNITY_REQUEST_FULFILLED" as never, eventId: "e2" });
    const impact = await getCommunityImpact(repo, "campus-demo");
    expect(impact.totalContributions).toBe(2);
    expect(impact.totalPointsAwarded).toBe(40);
    expect(impact.topContributors[0]?.points).toBe(25); // omar
  });
});
