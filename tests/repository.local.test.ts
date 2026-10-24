import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalRepository } from "@/services/repository.local";
import { buildSeed } from "@/seed/data";
import {
  AvailabilityStatus,
  RequestStatus,
  Resource,
  Request,
} from "@/domain/types";
import { nowIso } from "@/domain/time";

async function freshRepo(): Promise<LocalRepository> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "patch-test-"));
  const repo = new LocalRepository(dir);
  const now = new Date();
  const { users, resources, requests } = buildSeed(now);
  await repo.loadSeed({
    users: Object.fromEntries(users.map((u) => [u.id, u])),
    resources: Object.fromEntries(resources.map((r) => [r.id, r])),
    requests: Object.fromEntries(requests.map((r) => [r.id, r])),
  });
  return repo;
}

describe("LocalRepository — basic CRUD", () => {
  let repo: LocalRepository;
  beforeEach(async () => {
    repo = await freshRepo();
  });

  it("creates and retrieves a resource", async () => {
    const r: Resource = {
      id: "r-new", communityId: "campus-demo", ownerId: "user-maya",
      title: "Test item", description: "", resourceType: "ITEM",
      category: "SCHOOL_SUPPLIES", tags: [], condition: "GOOD",
      location: { label: "Union", zone: "Central" },
      availabilityStatus: AvailabilityStatus.AVAILABLE, availabilityWindows: [],
      exclusive: true, lendingRules: "", pickupInstructions: "",
      compatibility: { sourcePorts: [], sinkPorts: [], attributes: [] },
      createdAt: nowIso(), updatedAt: nowIso(),
    };
    await repo.putResource(r);
    const got = await repo.getResource("r-new");
    expect(got?.title).toBe("Test item");
  });

  it("filters resources by category and keyword", async () => {
    const byCat = await repo.queryResources({ communityId: "campus-demo", category: "ELECTRONICS_ADAPTERS" });
    expect(byCat.items.length).toBeGreaterThan(0);
    expect(byCat.items.every((r) => r.category === "ELECTRONICS_ADAPTERS")).toBe(true);

    const byKeyword = await repo.queryResources({ communityId: "campus-demo", keyword: "umbrella" });
    expect(byKeyword.items.some((r) => r.title.toLowerCase().includes("umbrella"))).toBe(true);
  });

  it("paginates", async () => {
    const page1 = await repo.queryResources({ communityId: "campus-demo", limit: 5 });
    expect(page1.items.length).toBe(5);
    expect(page1.nextCursor).toBeDefined();
    const page2 = await repo.queryResources({ communityId: "campus-demo", limit: 5, cursor: page1.nextCursor });
    expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
  });

  it("excludes archived by default", async () => {
    await repo.updateResource("res-umbrella", { availabilityStatus: AvailabilityStatus.ARCHIVED });
    const page = await repo.queryResources({ communityId: "campus-demo" });
    expect(page.items.find((r) => r.id === "res-umbrella")).toBeUndefined();
  });
});

describe("LocalRepository — concurrency-safe accept (AC-5)", () => {
  it("promises an exclusive item to exactly one of two concurrent accepts", async () => {
    const repo = await freshRepo();

    // Two pending requests for the SAME exclusive, available resource.
    const base = {
      communityId: "campus-demo",
      resourceId: "res-usbc-hdmi-1",
      resourceOwnerId: "user-priya",
      status: RequestStatus.PENDING,
      requestedTime: nowIso(),
      pickupContext: "",
      message: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const reqA: Request = { ...base, id: "cc-a", requesterId: "user-devin" };
    const reqB: Request = { ...base, id: "cc-b", requesterId: "user-sam" };
    await repo.putRequest(reqA);
    await repo.putRequest(reqB);

    // Fire both accepts concurrently.
    const [resA, resB] = await Promise.all([
      repo.acceptRequestAtomic({ requestId: "cc-a", reserveResource: true }),
      repo.acceptRequestAtomic({ requestId: "cc-b", reserveResource: true }),
    ]);

    const successes = [resA, resB].filter((r) => r.ok);
    const conflicts = [resA, resB].filter((r) => r.conflict);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(1);

    // The resource ends up RESERVED, not double-booked.
    const resource = await repo.getResource("res-usbc-hdmi-1");
    expect(resource?.availabilityStatus).toBe(AvailabilityStatus.RESERVED);

    // Exactly one request is ACCEPTED; the other remains PENDING.
    const a = await repo.getRequest("cc-a");
    const b = await repo.getRequest("cc-b");
    const accepted = [a, b].filter((r) => r?.status === RequestStatus.ACCEPTED);
    expect(accepted.length).toBe(1);
  });

  it("rejects accepting a non-available resource", async () => {
    const repo = await freshRepo();
    const req: Request = {
      id: "cc-reserved", communityId: "campus-demo",
      resourceId: "res-usbc-hdmi-2", // seeded as RESERVED
      resourceOwnerId: "user-theo", requesterId: "user-devin",
      status: RequestStatus.PENDING, requestedTime: nowIso(),
      pickupContext: "", message: "", createdAt: nowIso(), updatedAt: nowIso(),
    };
    await repo.putRequest(req);
    const res = await repo.acceptRequestAtomic({ requestId: "cc-reserved", reserveResource: true });
    expect(res.ok).toBe(false);
    expect(res.conflict).toBe(true);
  });
});
