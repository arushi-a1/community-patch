import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { LocalRepository } from "@/services/repository.local";
import { buildSeed } from "@/seed/data";
import {
  openConversation,
  sendMessage,
  getConversationThread,
  listConversations,
} from "@/services/messagingService";
import { createRequest, actOnRequest } from "@/services/requestService";
import { createCommunityRequest, createOffer } from "@/services/communityRequestService";
import { Category } from "@/domain/types";
import { Actor } from "@/domain/authz";

const priya: Actor = { userId: "user-priya", communityId: "campus-demo" }; // owner of res-usbc-hdmi-1
const devin: Actor = { userId: "user-devin", communityId: "campus-demo" };
const stranger: Actor = { userId: "user-omar", communityId: "campus-demo" };

async function freshRepo(): Promise<LocalRepository> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "patch-msg-"));
  const repo = new LocalRepository(dir);
  const s = buildSeed(new Date());
  await repo.loadSeed({
    users: Object.fromEntries(s.users.map((u) => [u.id, u])),
    resources: Object.fromEntries(s.resources.map((r) => [r.id, r])),
    requests: Object.fromEntries(s.requests.map((r) => [r.id, r])),
    communityRequests: Object.fromEntries(s.communityRequests.map((r) => [r.id, r])),
    offers: Object.fromEntries(s.offers.map((o) => [o.id, o])),
    notifications: Object.fromEntries(s.notifications.map((n) => [n.id, n])),
    conversations: Object.fromEntries(s.conversations.map((c) => [c.id, c])),
    messages: Object.fromEntries(s.messages.map((m) => [m.id, m])),
  });
  return repo;
}

async function acceptedRequestId(repo: LocalRepository): Promise<string> {
  const created = await createRequest(repo, devin, { resourceId: "res-usbc-hdmi-1" });
  if (!created.ok) throw new Error("setup");
  const accepted = await actOnRequest(repo, priya, created.value.id, "ACCEPT");
  if (!accepted.ok) throw new Error("setup");
  return created.value.id;
}

describe("messaging — resource request context", () => {
  let repo: LocalRepository;
  beforeEach(async () => (repo = await freshRepo()));

  it("opens one conversation for the participant pair (idempotent)", async () => {
    const reqId = await acceptedRequestId(repo);
    const a = await openConversation(repo, devin, "RESOURCE_REQUEST", reqId);
    const b = await openConversation(repo, priya, "RESOURCE_REQUEST", reqId);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.value.id).toBe(b.value.id);
  });

  it("lets participants send and read messages", async () => {
    const reqId = await acceptedRequestId(repo);
    const convo = await openConversation(repo, devin, "RESOURCE_REQUEST", reqId);
    if (!convo.ok) throw new Error("setup");

    const sent = await sendMessage(repo, devin, convo.value.id, "Hi! When can I grab it?");
    expect(sent.ok).toBe(true);

    const thread = await getConversationThread(repo, priya, convo.value.id);
    expect(thread.ok).toBe(true);
    if (thread.ok) {
      // The conversation was auto-seeded on request creation, so the new
      // message is the latest; both are visible to the owner.
      expect(thread.value.messages.length).toBeGreaterThanOrEqual(1);
      expect(thread.value.messages.some((m) => m.body.includes("grab it"))).toBe(true);
    }
  });

  it("blocks a non-participant from opening, reading, or sending", async () => {
    const reqId = await acceptedRequestId(repo);
    const convo = await openConversation(repo, devin, "RESOURCE_REQUEST", reqId);
    if (!convo.ok) throw new Error("setup");

    const open = await openConversation(repo, stranger, "RESOURCE_REQUEST", reqId);
    expect(open.ok).toBe(false);
    if (!open.ok) expect(open.error.kind).toBe("FORBIDDEN");

    const read = await getConversationThread(repo, stranger, convo.value.id);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.kind).toBe("FORBIDDEN");

    const send = await sendMessage(repo, stranger, convo.value.id, "let me in");
    expect(send.ok).toBe(false);
    if (!send.ok) expect(send.error.kind).toBe("FORBIDDEN");
  });

  it("tracks unread for the recipient and clears on read", async () => {
    const reqId = await acceptedRequestId(repo);
    const convo = await openConversation(repo, devin, "RESOURCE_REQUEST", reqId);
    if (!convo.ok) throw new Error("setup");
    await sendMessage(repo, devin, convo.value.id, "ping");

    const priyaList = await listConversations(repo, priya);
    const row = priyaList.find((c) => c.id === convo.value.id);
    expect(row?.unreadForMe).toBe(true);

    await getConversationThread(repo, priya, convo.value.id); // marks read
    const after = await listConversations(repo, priya);
    expect(after.find((c) => c.id === convo.value.id)?.unreadForMe).toBe(false);
  });
});

describe("messaging — community request context (chat on offer, pre-acceptance)", () => {
  it("a helper can message the requester as soon as they've offered", async () => {
    const repo = await freshRepo();
    const requester: Actor = { userId: "user-devin", communityId: "campus-demo" };
    const helper: Actor = { userId: "user-maya", communityId: "campus-demo" };
    const cr = await createCommunityRequest(repo, requester, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!cr.ok) throw new Error("setup");
    // Offering auto-opens a conversation (seeded with the offer note).
    const offer = await createOffer(repo, helper, cr.value.id, { message: "I've got one!" });
    expect(offer.ok).toBe(true);

    // Helper already has a conversation with a seeded first message.
    const convo = await openConversation(repo, helper, "COMMUNITY_REQUEST", cr.value.id);
    expect(convo.ok).toBe(true);
    if (!convo.ok) return;
    const thread = await getConversationThread(repo, helper, convo.value.id);
    expect(thread.ok).toBe(true);
    if (thread.ok) expect(thread.value.messages.some((m) => m.body.includes("got one"))).toBe(true);
  });

  it("the requester can message a specific helper who offered (by counterpart id)", async () => {
    const repo = await freshRepo();
    const requester: Actor = { userId: "user-devin", communityId: "campus-demo" };
    const helper: Actor = { userId: "user-maya", communityId: "campus-demo" };
    const cr = await createCommunityRequest(repo, requester, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!cr.ok) throw new Error("setup");
    await createOffer(repo, helper, cr.value.id, {});

    const convo = await openConversation(repo, requester, "COMMUNITY_REQUEST", cr.value.id, "user-maya");
    expect(convo.ok).toBe(true);
    if (convo.ok) expect(convo.value.participantIds.sort()).toEqual(["user-devin", "user-maya"]);
  });

  it("a non-offerer stranger cannot open a conversation on the request", async () => {
    const repo = await freshRepo();
    const requester: Actor = { userId: "user-devin", communityId: "campus-demo" };
    const helper: Actor = { userId: "user-maya", communityId: "campus-demo" };
    const strangerActor: Actor = { userId: "user-theo", communityId: "campus-demo" };
    const cr = await createCommunityRequest(repo, requester, { title: "a pencil", category: Category.SCHOOL_SUPPLIES });
    if (!cr.ok) throw new Error("setup");
    await createOffer(repo, helper, cr.value.id, {});
    const res = await openConversation(repo, strangerActor, "COMMUNITY_REQUEST", cr.value.id);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe("FORBIDDEN");
  });
});
