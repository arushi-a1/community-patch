// Live smoke test for the open community-request + notification flow.
const B = `http://localhost:${process.argv[2] ?? "3000"}`;
const out = [];
const log = (...a) => out.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
let cookies = {};
function setCookies(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(";");
    const [k, v] = kv.split("=");
    cookies[k] = v;
  }
}
async function j(method, path, body) {
  const res = await fetch(B + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") },
    body: body ? JSON.stringify(body) : undefined,
  });
  setCookies(res);
  const t = await res.text();
  return { status: res.status, body: t ? JSON.parse(t) : {} };
}

async function main() {
  // Devin posts an open request for a pencil.
  await j("POST", "/api/session", { userId: "user-devin" });
  const created = await j("POST", "/api/community-requests", {
    title: "a pencil for a quiz", category: "SCHOOL_SUPPLIES", quantity: 1, urgency: "CRITICAL",
    location: { label: "Library", zone: "Central" },
  });
  log("create:", created.status, "status:", created.body.status, "id:", created.body.id);
  const id = created.body.id;

  // Maya (nearby) should have a NEARBY_REQUEST notification.
  await j("POST", "/api/session", { userId: "user-maya" });
  const mayaNotifs = await j("GET", "/api/notifications");
  log("maya unread:", mayaNotifs.body.unread, "has nearby for this req:",
    mayaNotifs.body.items.some((n) => n.type === "NEARBY_REQUEST" && n.href?.includes(id)));

  // Maya offers to help.
  const offer = await j("POST", `/api/community-requests/${id}/offers`, { message: "I've got a spare!" });
  log("offer:", offer.status, offer.body.status);

  // Devin sees the offer + a NEW_OFFER notification.
  await j("POST", "/api/session", { userId: "user-devin" });
  const devinNotifs = await j("GET", "/api/notifications");
  log("devin has NEW_OFFER:", devinNotifs.body.items.some((n) => n.type === "NEW_OFFER"));
  const detail = await j("GET", `/api/community-requests/${id}`);
  log("devin sees offers:", detail.body.offers.length, "isRequester:", detail.body.isRequester);

  // Devin accepts Maya's offer.
  const offerId = detail.body.offers[0].id;
  const accepted = await j("POST", `/api/offers/${offerId}/accept`);
  log("accept:", accepted.status, "reqStatus:", accepted.body.request?.status);

  // Maya gets OFFER_ACCEPTED.
  await j("POST", "/api/session", { userId: "user-maya" });
  const mayaAfter = await j("GET", "/api/notifications");
  log("maya has OFFER_ACCEPTED:", mayaAfter.body.items.some((n) => n.type === "OFFER_ACCEPTED"));

  // Stranger (Sam) cannot accept/offer illegitimately.
  await j("POST", "/api/session", { userId: "user-sam" });
  const strangerAccept = await j("POST", `/api/offers/${offerId}/accept`);
  log("stranger accept blocked (want 403/409):", strangerAccept.status);

  // Devin resolves.
  await j("POST", "/api/session", { userId: "user-devin" });
  const resolved = await j("POST", `/api/community-requests/${id}/resolve`);
  log("resolve:", resolved.status, "status:", resolved.body.status);

  console.log(out.join("\n"));
}
main().catch((e) => { console.error("SMOKE FAILED:", e); process.exit(1); });
