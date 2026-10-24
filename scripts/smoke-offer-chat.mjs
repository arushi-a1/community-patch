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
  // Devin posts a request.
  await j("POST", "/api/session", { userId: "user-devin" });
  const cr = await j("POST", "/api/community-requests", { title: "a ruler", category: "SCHOOL_SUPPLIES" });
  const crid = cr.body.id;
  log("request:", cr.status, crid);
  // Maya offers (NOT accepted) — should auto-create a conversation.
  await j("POST", "/api/session", { userId: "user-maya" });
  const offer = await j("POST", `/api/community-requests/${crid}/offers`, { message: "I have a ruler, meet at Odegaard?" });
  log("offer:", offer.status);
  const mayaConvos = await j("GET", "/api/conversations");
  log("maya sees conversation after offering (pre-accept):", mayaConvos.body.items.length > 0);
  const convo = mayaConvos.body.items.find((c) => c.subject === "a ruler");
  log("convo preview seeded with offer note:", convo?.lastMessagePreview);
  // Devin (requester) sees it too, unread.
  await j("POST", "/api/session", { userId: "user-devin" });
  const devinConvos = await j("GET", "/api/conversations");
  const dConvo = devinConvos.body.items.find((c) => c.subject === "a ruler");
  log("devin sees conversation:", Boolean(dConvo), "unread:", dConvo?.unreadForMe);
  // Devin replies before accepting.
  const reply = await j("POST", `/api/conversations/${dConvo.id}/messages`, { body: "Yes! 2pm works." });
  log("devin reply before accept:", reply.status);
  console.log(out.join("\n"));
}
main().catch((e) => { console.error("FAIL", e); process.exit(1); });
