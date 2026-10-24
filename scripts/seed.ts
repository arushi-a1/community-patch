/**
 * Seed the LOCAL repository with the deterministic demo community.
 *   npm run seed
 *
 * Only affects local persistence (.data/db.json). Does not touch AWS.
 */
import { buildSeed, RESOURCE_COUNT } from "../src/seed/data";
import { LocalRepository } from "../src/services/repository.local";

async function main() {
  const now = new Date();
  const s = buildSeed(now);
  const { users, resources, requests, communityRequests, offers, notifications, conversations, messages } = s;

  const repo = new LocalRepository();
  await repo.loadSeed({
    users: Object.fromEntries(users.map((u) => [u.id, u])),
    resources: Object.fromEntries(resources.map((r) => [r.id, r])),
    requests: Object.fromEntries(requests.map((r) => [r.id, r])),
    communityRequests: Object.fromEntries(communityRequests.map((r) => [r.id, r])),
    offers: Object.fromEntries(offers.map((o) => [o.id, o])),
    notifications: Object.fromEntries(notifications.map((n) => [n.id, n])),
    conversations: Object.fromEntries(conversations.map((c) => [c.id, c])),
    messages: Object.fromEntries(messages.map((m) => [m.id, m])),
    pointTransactions: Object.fromEntries(s.pointTransactions.map((t) => [t.id, t])),
  });

  console.log(
    `Seeded campus-demo: ${users.length} users, ${resources.length} resources (${RESOURCE_COUNT} defined), ${requests.length} resource requests, ${communityRequests.length} community requests, ${offers.length} offers.`,
  );
  console.log("Data written to .data/db.json");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
