// Live end-to-end smoke test against a running dev server (PORT via arg or 3200).
const B = `http://localhost:${process.argv[2] ?? "3200"}`;
const out = [];
const log = (...a) => out.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));

let cookies = {};
function setCookies(res) {
  const sc = res.headers.getSetCookie?.() ?? [];
  for (const c of sc) {
    const [kv] = c.split(";");
    const [k, v] = kv.split("=");
    cookies[k] = v;
  }
}
function cookieHeader() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
}
async function j(method, path, body) {
  const res = await fetch(B + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  setCookies(res);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : {} };
}

async function main() {
  // act as Maya
  await j("POST", "/api/session", { userId: "user-maya" });
  const s = await j("GET", "/api/session");
  log("session devMode:", s.body.devMode, "actor:", s.body.actor.userId);

  // analyze signature scenario
  const a = await j("POST", "/api/fixes/analyze", {
    text: "Our event starts in 15 minutes in the student union. The presenter laptop only has USB-C, and the projector uses HDMI. Connect them now.",
    requesterLat: 40.0017,
    requesterLng: -83.015,
    requesterZone: "Central",
  });
  log("analyze provider:", a.body.provider);
  log("analyze matches:", a.body.matches.map((m) => `${m.resource.id}@${Math.round(m.score.total * 100)}%`).join(", "));

  // create request for Priya's adapter
  const created = await j("POST", "/api/requests", {
    resourceId: "res-usbc-hdmi-1",
    message: "Need it for a talk",
    pickupContext: "Union entrance",
  });
  log("create request status:", created.status, "reqStatus:", created.body.status);
  const rid = created.body.id;

  // Maya view while pending -> pickup hidden
  const pending = await j("GET", `/api/requests/${rid}`);
  log("pending view -> reqStatus:", pending.body.request.status, "pickup:", pending.body.pickupInstructions ?? "(hidden)");

  // concurrency check: a second identical request should dedup
  const dup = await j("POST", "/api/requests", { resourceId: "res-usbc-hdmi-1" });
  log("dedup -> sameId:", dup.body.id === rid);

  // switch to Priya and accept
  await j("POST", "/api/session", { userId: "user-priya" });
  const accepted = await j("POST", `/api/requests/${rid}/accept`);
  log("accept status:", accepted.status, "reqStatus:", accepted.body.request?.status, "resourceStatus:", accepted.body.resource?.availabilityStatus);

  // Maya view now -> pickup visible
  await j("POST", "/api/session", { userId: "user-maya" });
  const acceptedView = await j("GET", `/api/requests/${rid}`);
  log("accepted view -> reqStatus:", acceptedView.body.request.status, "pickup:", acceptedView.body.pickupInstructions ?? "(hidden)");

  // stranger (Sam) cannot view
  await j("POST", "/api/session", { userId: "user-sam" });
  const stranger = await j("GET", `/api/requests/${rid}`);
  log("stranger view status (want 403):", stranger.status);

  // authz: Sam cannot accept someone else's request (already accepted anyway -> expect 403 or 409)
  const samAccept = await j("POST", `/api/requests/${rid}/accept`);
  log("sam accept status (want 403):", samAccept.status);

  // complete as Maya (participant) -> resource freed
  await j("POST", "/api/session", { userId: "user-maya" });
  const completed = await j("POST", `/api/requests/${rid}/complete`);
  log("complete status:", completed.status, "resourceStatus:", completed.body.resource?.availabilityStatus);

  // reset to clean state
  const reset = await j("POST", "/api/dev/reset");
  log("reset status:", reset.status, "ok:", reset.body.ok);

  console.log(out.join("\n"));
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e);
  process.exit(1);
});
