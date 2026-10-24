import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalRepository } from "@/services/repository.local";
import { buildSeed } from "@/seed/data";
import { createRequest, actOnRequest, getRequestForActor } from "@/services/requestService";
import { Actor } from "@/domain/authz";
import { AvailabilityStatus, RequestStatus } from "@/domain/types";

const maya: Actor = { userId: "user-maya", communityId: "campus-demo" };
const devin: Actor = { userId: "user-devin", communityId: "campus-demo" };
const sam: Actor = { userId: "user-sam", communityId: "campus-demo" };

async function freshRepo(): Promise<LocalRepository> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "patch-svc-"));
  const repo = new LocalRepository(dir);
  const { users, resources, requests } = buildSeed(new Date());
  await repo.loadSeed({
    users: Object.fromEntries(users.map((u) => [u.id, u])),
    resources: Object.fromEntries(resources.map((r) => [r.id, r])),
    requests: Object.fromEntries(requests.map((r) => [r.id, r])),
  });
  return repo;
}

describe("createRequest", () => {
  let repo: LocalRepository;
  beforeEach(async () => (repo = await freshRepo()));

  it("creates a pending request for a borrower", async () => {
    const res = await createRequest(repo, devin, { resourceId: "res-usbc-hdmi-1" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.status).toBe(RequestStatus.PENDING);
  });

  it("blocks the owner from borrowing their own exclusive item", async () => {
    // res-usbc-hdmi-1 is owned by user-priya
    const priya: Actor = { userId: "user-priya", communityId: "campus-demo" };
    const res = await createRequest(repo, priya, { resourceId: "res-usbc-hdmi-1" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("FORBIDDEN");
  });

  it("de-duplicates repeated open requests (idempotency)", async () => {
    const a = await createRequest(repo, devin, { resourceId: "res-usbc-hdmi-1" });
    const b = await createRequest(repo, devin, { resourceId: "res-usbc-hdmi-1" });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.value.id).toBe(b.value.id);
  });

  it("404s for a missing resource", async () => {
    const res = await createRequest(repo, devin, { resourceId: "nope" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("NOT_FOUND");
  });
});

describe("actOnRequest — authorization + lifecycle", () => {
  let repo: LocalRepository;
  beforeEach(async () => (repo = await freshRepo()));

  it("full happy path: create -> accept -> complete, resource reserved then freed", async () => {
    const created = await createRequest(repo, devin, { resourceId: "res-usbc-hdmi-1" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.value.id;

    // Only the owner (priya) can accept.
    const priya: Actor = { userId: "user-priya", communityId: "campus-demo" };
    const accepted = await actOnRequest(repo, priya, id, "ACCEPT");
    expect(accepted.ok).toBe(true);
    const afterAccept = await repo.getResource("res-usbc-hdmi-1");
    expect(afterAccept?.availabilityStatus).toBe(AvailabilityStatus.RESERVED);

    const completed = await actOnRequest(repo, priya, id, "COMPLETE");
    expect(completed.ok).toBe(true);
    const afterComplete = await repo.getResource("res-usbc-hdmi-1");
    expect(afterComplete?.availabilityStatus).toBe(AvailabilityStatus.AVAILABLE);
  });

  it("a non-owner cannot accept", async () => {
    const created = await createRequest(repo, devin, { resourceId: "res-usbc-hdmi-1" });
    if (!created.ok) throw new Error("setup failed");
    // sam is neither requester-authorized-to-accept nor owner
    const res = await actOnRequest(repo, sam, created.value.id, "ACCEPT");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("FORBIDDEN");
  });

  it("cannot complete a pending request (illegal transition)", async () => {
    const created = await createRequest(repo, devin, { resourceId: "res-usbc-hdmi-1" });
    if (!created.ok) throw new Error("setup failed");
    const priya: Actor = { userId: "user-priya", communityId: "campus-demo" };
    const res = await actOnRequest(repo, priya, created.value.id, "COMPLETE");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("CONFLICT");
  });

  it("declining a pending request frees nothing but marks declined", async () => {
    const created = await createRequest(repo, devin, { resourceId: "res-folding-table" });
    if (!created.ok) throw new Error("setup failed");
    const res = await actOnRequest(repo, maya, created.value.id, "DECLINE");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.request.status).toBe(RequestStatus.DECLINED);
  });
});

describe("getRequestForActor — pickup disclosure", () => {
  it("hides pickup until accepted, then reveals to participants", async () => {
    const repo = await freshRepo();
    const created = await createRequest(repo, devin, { resourceId: "res-usbc-hdmi-1" });
    if (!created.ok) throw new Error("setup failed");
    const id = created.value.id;

    const pending = await getRequestForActor(repo, devin, id);
    expect(pending.ok).toBe(true);
    if (pending.ok) expect(pending.value.pickupVisible).toBe(false);

    const priya: Actor = { userId: "user-priya", communityId: "campus-demo" };
    await actOnRequest(repo, priya, id, "ACCEPT");

    const afterAccept = await getRequestForActor(repo, devin, id);
    expect(afterAccept.ok).toBe(true);
    if (afterAccept.ok) expect(afterAccept.value.pickupVisible).toBe(true);
  });

  it("denies a stranger from viewing a request", async () => {
    const repo = await freshRepo();
    const created = await createRequest(repo, devin, { resourceId: "res-usbc-hdmi-1" });
    if (!created.ok) throw new Error("setup failed");
    const res = await getRequestForActor(repo, sam, created.value.id);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("FORBIDDEN");
  });
});
