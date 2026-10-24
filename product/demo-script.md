# PATCH — Demo Script

A 3–4 minute walkthrough for a hackathon judge. All data is seeded in a clearly-labeled demo community (`campus-demo`). Nothing here claims real campus partnerships or live availability.

## Setup (once)
```
npm install
npm run seed       # loads the deterministic demo community
npm run dev        # http://localhost:3000
```
Local mode needs no AWS credentials. The profile menu (top-right) has a **dev user switcher** so you can act as different community members to show both sides of a request.

---

## Scene 0 — The pitch (15s)
"Everyone hits tiny, urgent problems — a missing adapter, a calculator before an exam, an extra pair of hands. The fix is usually 50 feet away but invisible. PATCH asks *'what's going wrong?'* and finds the real, available, compatible solution nearby."

## Scene 1 — Signature scenario: USB-C ↔ HDMI, 15 minutes (90s)
1. On the home hero, submit:
   > "Our event starts in 15 minutes in the student union. The presenter's laptop only has USB-C, and the projector uses HDMI. We need a way to connect them immediately."
2. Point out the **interpreted need** recap: location = Student Union, deadline ≈ 15 min, compatibility = USB-C source → HDMI sink, type = item.
3. Results show the **best compatible, currently-available** adapter/hub with a *grounded* "why it matches" (real fields + score components) and a walk estimate only because this resource has coordinates.
4. **Key edge case:** there is also a seeded USB-C→HDMI adapter that is **already reserved** and an HDMI-only cable that is **incompatible** with a USB-C source. Neither is offered as a feasible match — show that PATCH filters them out rather than keyword-matching "HDMI".
5. Show the **alternative**: a nearby room/hub option, labeled *needs confirmation* where appropriate.

## Scene 2 — Make the request + owner accepts (45s)
1. Click **Request this** on the top match, set pickup context + a short message, submit. Note the status: **Pending — not confirmed until the owner accepts.**
2. Switch to the **owner** via the dev switcher → **My Activity → Incoming** → **Accept**.
3. Switch back to the requester → status is now **Accepted**, and **pickup instructions are now visible** (they were hidden before).

## Scene 3 — Concurrency safety (optional, 20s)
Mention/show (via the test `npm test -- concurrency`) that two simultaneous accepts of the same exclusive item result in exactly one `ACCEPTED`; the other fails cleanly. No double-booking.

## Scene 4 — Second scenario: calculator for an exam (30s)
Submit:
> "I need a calculator for my exam this afternoon."
Show available calculators returned, and that PATCH **does not assume** every calculator is exam-permitted (a seeded graphing calculator flagged "not permitted in some exams" is labeled/deprioritized, not silently recommended).

## Scene 5 — Third scenario: human assistance (30s)
Submit:
> "We need another pair of hands to help set up tables for an event in 20 minutes."
Show that PATCH returns **assistance** listings (not item loans), respects the helper's availability window, and matches on capability.

## Scene 6 — Graceful degradation (20s)
With `PATCH_AI_PROVIDER=local` (the default), the same flows work using the deterministic analyzer — the product is not a single point of failure on the model. Flip to `bedrock` only when credentials exist.

## Scene 7 — Honest engineering (15s)
Call out: real persisted state, enforced authorization, no fabricated walking times, privacy-conscious community feed, and the AI-grounding pipeline (model output is data, re-checked against real rows).

---

## What to emphasize to judges
- **Problem-first UX** that interprets intent, not keywords.
- **Grounded AI**: every recommendation maps to a real, feasible database row.
- **Reliable engineering**: real states, enforced transitions, concurrency-safe accepts.
- **Thoughtful AWS mapping**: DynamoDB single-table + transactions, Bedrock, Cognito, API Gateway/Lambda — each earning its place (see `product/architecture.md`).
- **Runs anywhere**: fully local, zero-credential demo; AWS is a documented, swappable upgrade.

## Reset between demos
```
npm run seed        # or POST /api/dev/reset (dev mode only)
```

---

## Updated walkthrough (current build)

Setup: `npm run seed && npm run dev` → http://localhost:3000. Use the profile-menu **dev user switcher** to play both sides. Demo community is UW/Seattle (`campus-demo`), sample data.

**Scene 1 — The map-first hero (15s).** The home page opens onto the live **UW community map** with the AI composer floating over it, and a leaderboard + open-request pulse below. "Everything here is real community data — resources, open needs, neighbors."

**Scene 2 — Signature fix (60s).** Type (or tap a chip): *"My presentation starts in 15 minutes, laptop is USB-C, projector is HDMI."* → compatible **available** adapter ranked first with a grounded explanation; the **reserved** adapter and the **HDMI-only cable** are ruled out ("why we ruled out…"); a **hub alternative** is offered. Point out it's labeled **Rule-based** (deterministic, works with no AI).

**Scene 3 — AI actually understands (20s).** Type *"I'm bleeding and need a Band-Aid"* → **first-aid supplies** (not an umbrella), with a gentle safety note. This is the intent-understanding fix.

**Scene 4 — Ask the community → offer → chat → resolve → points (90s).**
1. Post an open request for something unlisted (e.g. *"a pencil before my quiz"*).
2. Switch to a nearby member → the **notification bell** shows the nearby request → open it → **Offer to help** with a note.
3. Note a **conversation immediately appears in Messages** for both people (seeded with the offer note) — chat a line.
4. Switch back to the requester → **accept** the offer → **Mark resolved** → **confetti celebration** + the helper earns **+25 PATCH Points**.

**Scene 5 — Borrow flow + completion (30s).** Request a listed resource → owner accepts (availability revalidated, concurrency-safe) → pickup instructions appear only now → **Mark complete** → lender earns **+15** with a celebration.

**Scene 6 — Community & recognition (30s).** Home-page **leaderboard** → click a neighbor → their **public profile** (points, badges, shared resources). Open **/points** to show badges, progress to the next badge, community milestones, and the contribution history.

**Scene 7 — Honest engineering (15s).** Call out: real persisted state, enforced authz, concurrency-safe acceptance (resource double-booking *and* offer double-accept), idempotent points (resolving twice awards once), privacy-jittered map, and grounded AI. Mention Bedrock is a documented, swappable upgrade; the demo runs fully local.

### Reset between runs
Profile menu → **Reset demo data** (dev only), or `npm run seed`.
