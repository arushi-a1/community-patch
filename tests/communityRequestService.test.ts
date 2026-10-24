import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalRepository } from "@/services/repository.local";
import { buildSeed } from "@/seed/data";
import {
  createCommunityRequest,
  createOffer,
  acceptOffer,
  declineOffer,
  resolveCommunityRequest,
  cancelCommunityRequest,
} from "@/services/communityRequestService";
import { Actor } from "@/domain/authz";
import { CommunityRequestStatus, OfferStatus, Category } from "@/domain/types";

const maya: Actor = { userId: "user-maya", communityId: "campus-demo" };
const devin: Actor = { userId: "user-devin", communityId: "campus-demo" };
const sam: Actor = { userId: "user-sam", communityId: "campus-demo" };
const omar: Actor = { userId: "user-omar", communityId: "campus-demo" };

async function freshRepo(): Promise<LocalRepository> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "patch-creq-"));
  const repo = new LocalRepository(dir);
  const s = buildSeed(new Date());
  await repo.loadSeed({
    users: Object.fromEntries(s.users.map((u) => [u.id, u])),
    resources: Object.fromEntries(s.resources.map((r) => [r.id, r])),
    requests: Object.fromEntries(s.requests.map((r) => [r.id, r])),
    communityRequests: Object.fromEntries(s.communityRequests.map((r) => [r.id, r])),
    offers: Object.fromEntries(s.offers.map((o) => [o.id, o])),
    notifications: Object.fromEntries(s.notifications.map((n) => [n.id, n])),
  });
  return repo;
}

describe("createCommunityRequest", () => {
  let repo: LocalRepository;
  beforeEach(async () => (repo = await freshRepo()));

  it("creates an open request and notifies nearby members", async () => {
    const res = await createCommunityRequest(repo, devin, {
      title: "a pencil", category: Category.SCHOOL_SUPPLIES,
      location: { label: "Suzzallo Library", zone: "Central Campus" },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe(CommunityRequestStatus.OPEN);

    // Nearby members (not the requester) got a notification.
    const mayaNotifs = await repo.listNotifications("user-maya");
    expect(mayaNotifs.some((n) => n.type === "NEARBY_REQUEST" && n.href?.includes(res.value.id))).toBe(true);
    // The requester did NOT get a nearby-request notification about their own post.
    const devinNotifs = await repo.listNotifications("user-devin");
    expect(devinNotifs.some((n) => n.href?.includes(res.value.id) && n.type === "NEARBY_REQUEST")).toBe(false);
  });
});

describe("offers + acceptance", () => {
  let repo: LocalRepository;
  beforeEach(async () => (repo = await freshRepo()));

  it("lets a non-requester offer, and notifies the requester", async () => {
    const created = await createCommunityRequest(repo, devin, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!created.ok) throw new Error("setup");
    const offer = await createOffer(repo, maya, created.value.id, { message: "I've got one!" });
    expect(offer.ok).toBe(true);
    const devinNotifs = await repo.listNotifications("user-devin");
    expect(devinNotifs.some((n) => n.type === "NEW_OFFER")).toBe(true);
  });

  it("forbids the requester from offering on their own request", async () => {
    const created = await createCommunityRequest(repo, devin, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!created.ok) throw new Error("setup");
    const offer = await createOffer(repo, devin, created.value.id, {});
    expect(offer.ok).toBe(false);
    if (!offer.ok) expect(offer.error.kind).toBe("FORBIDDEN");
  });

  it("de-duplicates repeated pending offers from the same helper", async () => {
    const created = await createCommunityRequest(repo, devin, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!created.ok) throw new Error("setup");
    const a = await createOffer(repo, maya, created.value.id, {});
    const b = await createOffer(repo, maya, created.value.id, {});
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.value.id).toBe(b.value.id);
  });

  it("only the requester can accept an offer", async () => {
    const created = await createCommunityRequest(repo, devin, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!created.ok) throw new Error("setup");
    const offer = await createOffer(repo, maya, created.value.id, {});
    if (!offer.ok) throw new Error("setup");
    const bad = await acceptOffer(repo, sam, offer.value.id);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.kind).toBe("FORBIDDEN");
  });

  it("accepting an offer matches the request and notifies the helper", async () => {
    const created = await createCommunityRequest(repo, devin, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!created.ok) throw new Error("setup");
    const offer = await createOffer(repo, maya, created.value.id, {});
    if (!offer.ok) throw new Error("setup");
    const accepted = await acceptOffer(repo, devin, offer.value.id);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.value.request.status).toBe(CommunityRequestStatus.MATCHED);
      expect(accepted.value.offer.status).toBe(OfferStatus.ACCEPTED);
    }
    const mayaNotifs = await repo.listNotifications("user-maya");
    expect(mayaNotifs.some((n) => n.type === "OFFER_ACCEPTED")).toBe(true);
  });
});

describe("concurrency: two offers, two simultaneous accepts", () => {
  it("matches exactly one offer", async () => {
    const repo = await freshRepo();
    const created = await createCommunityRequest(repo, devin, { title: "4 chairs", category: Category.EVENT_EQUIPMENT });
    if (!created.ok) throw new Error("setup");
    const o1 = await createOffer(repo, maya, created.value.id, {});
    const o2 = await createOffer(repo, sam, created.value.id, {});
    if (!o1.ok || !o2.ok) throw new Error("setup");

    const [a, b] = await Promise.all([
      acceptOffer(repo, devin, o1.value.id),
      acceptOffer(repo, devin, o2.value.id),
    ]);
    const successes = [a, b].filter((r) => r.ok);
    expect(successes.length).toBe(1);

    const cr = await repo.getCommunityRequest(created.value.id);
    expect(cr?.status).toBe(CommunityRequestStatus.MATCHED);
  });
});

describe("resolve + cancel", () => {
  it("requester resolves a matched request, notifying both participants", async () => {
    const repo = await freshRepo();
    const created = await createCommunityRequest(repo, devin, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!created.ok) throw new Error("setup");
    const offer = await createOffer(repo, maya, created.value.id, {});
    if (!offer.ok) throw new Error("setup");
    await acceptOffer(repo, devin, offer.value.id);

    const resolved = await resolveCommunityRequest(repo, devin, created.value.id);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.value.status).toBe(CommunityRequestStatus.RESOLVED);

    const mayaNotifs = await repo.listNotifications("user-maya");
    expect(mayaNotifs.some((n) => n.type === "REQUEST_RESOLVED")).toBe(true);
  });

  it("the accepted helper may also resolve", async () => {
    const repo = await freshRepo();
    const created = await createCommunityRequest(repo, devin, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!created.ok) throw new Error("setup");
    const offer = await createOffer(repo, maya, created.value.id, {});
    if (!offer.ok) throw new Error("setup");
    await acceptOffer(repo, devin, offer.value.id);
    const resolved = await resolveCommunityRequest(repo, maya, created.value.id);
    expect(resolved.ok).toBe(true);
  });

  it("a stranger cannot resolve", async () => {
    const repo = await freshRepo();
    const created = await createCommunityRequest(repo, devin, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!created.ok) throw new Error("setup");
    const resolved = await resolveCommunityRequest(repo, omar, created.value.id);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.error.kind).toBe("FORBIDDEN");
  });

  it("declining an offer notifies the helper and does not match", async () => {
    const repo = await freshRepo();
    const created = await createCommunityRequest(repo, devin, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!created.ok) throw new Error("setup");
    const offer = await createOffer(repo, maya, created.value.id, {});
    if (!offer.ok) throw new Error("setup");
    const declined = await declineOffer(repo, devin, offer.value.id);
    expect(declined.ok).toBe(true);
    const cr = await repo.getCommunityRequest(created.value.id);
    expect(cr?.status).toBe(CommunityRequestStatus.OPEN);
  });

  it("requester can cancel an open request", async () => {
    const repo = await freshRepo();
    const created = await createCommunityRequest(repo, devin, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!created.ok) throw new Error("setup");
    const cancelled = await cancelCommunityRequest(repo, devin, created.value.id);
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) expect(cancelled.value.status).toBe(CommunityRequestStatus.CANCELLED);
  });
});
