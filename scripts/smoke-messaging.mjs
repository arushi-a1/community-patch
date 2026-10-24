const B = `http://localhost:${process.argv[2] ?? "3000"}`;
const out = [];
const log = (...a) => out.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
let cookies = {};
function setCookies(res) { for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const [k, v] = kv.split("="); cookies[k] = v; } }
async function j(method, path, body) {
  const res = await fetch(B + path, { method, headers: { "Content-Type": "application/json", Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") }, body: body ? JSON.stringify(body) : undefined });
  setCookies(res); const t = await res.text(); return { status: res.status, body: t ? JSON.parse(t) : {} };
}
async function main() {
  // Devin requests Priya's adapter; Priya accepts; then they message.
  await j("POST", "/api/session", { userId: "user-devin" });
  const req = await j("POST", "/api/requests", { resourceId: "res-usbc-hdmi-1" });
  log("request:", req.status, req.body.status);
  await j("POST", "/api/session", { userId: "user-priya" });
  const acc = await j("POST", `/api/requests/${req.body.id}/accept`);
  log("accept:", acc.status, acc.body.request?.status);
  // Devin opens conversation + sends
  await j("POST", "/api/session", { userId: "user-devin" });
  const convo = await j("POST", "/api/conversations", { contextType: "RESOURCE_REQUEST", contextId: req.body.id });
  log("open convo:", convo.status, "id?", Boolean(convo.body.id));
  const msg = await j("POST", `/api/conversations/${convo.body.id}/messages`, { body: "Hi Priya, can I grab it at 2pm?" });
  log("send:", msg.status);
  // Priya reads + replies
  await j("POST", "/api/session", { userId: "user-priya" });
  const list = await j("GET", "/api/conversations");
  log("priya convo unread:", list.body.items.find((c) => c.id === convo.body.id)?.unreadForMe);
  const thread = await j("GET", `/api/conversations/${convo.body.id}`);
  log("priya sees messages:", thread.body.messages.length);
  // Stranger blocked
  await j("POST", "/api/session", { userId: "user-sam" });
  const blocked = await j("GET", `/api/conversations/${convo.body.id}`);
  log("stranger read (want 403):", blocked.status);
  console.log(out.join("\n"));
}
main().catch((e) => { console.error("SMOKE FAILED:", e); process.exit(1); });
