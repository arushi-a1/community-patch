# PATCH

> **Your community, one solution away.**
> A hyperlocal, AI-powered, **problem-first** community platform. Describe what's going wrong, and PATCH finds the real people, things, and resources nearby that can fix it — and lets you coordinate, help back, and build a culture of neighbors looking out for each other.

Hackathon theme: **Within Reach — solve what is close to you.**

The demo community is **UW / Seattle** (`campus-demo`), with fictional members and clearly-labeled sample data.

---

## Why PATCH

People constantly hit small, urgent problems — a missing USB-C adapter five minutes before a talk, a calculator for an exam, an extra pair of hands to move tables, a pencil right before a quiz. The fix is usually 50 feet away but invisible.

Marketplaces make you search for *products*. Lending apps make you browse *inventories*. Group chats make you guess *who to ask*. PATCH starts from a different question:

> **"What's going wrong, and how can we help you fix it?"**

You describe a problem in plain language. PATCH interprets the underlying need, retrieves **real** resources from its database, rules out infeasible options with deterministic logic, ranks the feasible ones transparently, shows them **on a map**, and helps you connect. If nothing's listed, you can **ask the community** and a neighbor can step up — then you coordinate in **messages**, resolve it, and earn **PATCH Points** for helping.

<img width="1298" height="958" alt="Screenshot 2026-10-23 at 11 14 31 PM" src="https://github.com/user-attachments/assets/f47209c6-05ca-47bc-bf09-1d896745c347" />

## What makes it different

- **Problem-first, not item-first.** The signature "I need a fix" flow interprets intent, not keywords ("I'm bleeding, need a Band-Aid" → first-aid supplies, not an umbrella).
- **Grounded AI.** Every recommendation maps to a real, feasible database row. Model output is treated as *data*, re-checked against actual inventory — it can never invent resources or take privileged actions. Works fully without AI via a deterministic analyzer.
- **A matching engine that respects reality.** Hard constraints (availability, compatibility, time, distance, quantity, assistance-vs-item) disqualify options *before* scoring. A reserved-but-compatible adapter is never shown as available; an HDMI-only cable is never offered for a USB-C laptop.
- **People, not just objects.** Open community requests let anyone post "I need X" even when nothing's listed; nearby neighbors are notified and can offer to help.
- **A living map.** A UW-centered interactive map is the home-page hero, with privacy-safe approximate pins for resources, assistance, and open needs.
- **Real coordination.** Persisted conversations (polling-based) open the moment you offer help or request an item.
- **A culture of helpfulness.** PATCH Points reward *verified, completed* contributions — idempotent, server-validated, with badges, community milestones, a leaderboard, and public profiles.
- **Reliable engineering.** Real persisted state, enforced authorization, explicit lifecycle state machines, concurrency-safe acceptance (an exclusive item can't be promised to two borrowers; an offer can't be double-accepted), and idempotent point awards.
- **Runs anywhere.** Fully local, zero-credential demo; AWS is a documented, swappable upgrade.

---

## Features

| Area | What it does |
|---|---|
| **I need a fix** | Natural-language problem → grounded, ranked matches + honest alternatives. Falls back to "ask the community" when nothing fits. |
| **Interactive map** | Leaflet + OpenStreetMap, UW-centered, warm-tinted. Branded pins by type, detail panel, filters, synced list, geolocation, graceful tile-failure fallback. |
| **Discover** | Browse/search/filter all shared resources. |
| **Resources** | Create, **edit**, and manage availability of items or assistance offers you share. |
| **Community requests** | Post an open "I need X" that isn't a listed resource; neighbors nearby get notified and can **offer help**. |
| **Offers & acceptance** | Requesters review offers, accept one (concurrency-safe), and resolve. |
| **Messaging** | Persisted conversations that open the instant you offer/request; chat, unread tracking, optimistic send. |
| **Notifications** | In-app bell with unread badge + polling; nearby-request, new-offer, accepted, resolved, points. |
| **PATCH Points** | Verified-contribution ledger, badges, community milestones, a `/points` page, and a landing-page leaderboard. |
| **Profiles** | Public `/u/[id]` pages with avatar, points, badges, and shared resources — linked from names throughout. |
| **Request lifecycle** | Explicit states + server-enforced transitions for both resource requests and community requests. |

<img width="1292" height="947" alt="Screenshot 2026-10-23 at 11 15 04 PM" src="https://github.com/user-attachments/assets/ed4ea5d1-291d-49a4-897e-3eb599ef8d04" />


---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                       Next.js (React 19, App Router)                     │
│  Map hero · Discover · Fix · Community · Messages · Points · Profiles    │
└───────────────┬──────────────────────────────────────────────────────────┘
                │ typed fetch (polling for live views)
┌───────────────▼──────────────────────────────────────────────────────────┐
│            API layer   (Next Route Handlers  ⇄  Lambda in AWS)            │
│       zod-validated boundaries · authz · rate limiting · error mapping     │
└───────┬───────────────────────────┬──────────────────────────┬───────────┘
        │                           │                          │
┌───────▼───────┐         ┌─────────▼─────────┐        ┌────────▼────────┐
│  Domain core  │         │   Persistence     │        │   AI service    │
│ matching ·    │◄───────►│  Repository iface │        │  AIService iface│
│ lifecycle ·   │         │  Local JSON  /    │        │  Local analyzer │
│ authz · safety│         │  DynamoDB adapter │        │  / Bedrock      │
│ points · geo  │         └───────────────────┘        └─────────────────┘
└───────────────┘
```

Domain logic, persistence, and AI are each behind interfaces. Swapping local adapters for AWS adapters doesn't touch the UI or the business rules. Full detail in [`product/architecture.md`](product/architecture.md).

### Technology stack

| Concern | Local mode (default) | AWS mode (designed & documented) |
|---|---|---|
| UI | Next.js 15 + React 19 + TypeScript | same |
| Styling / icons | Tailwind CSS v4 (sage & clay theme) · lucide-react | same |
| Maps | Leaflet + react-leaflet + OpenStreetMap tiles | same |
| Fonts | Fraunces (display) + Inter (sans) via next/font | same |
| Validation | zod | same |
| API | Next Route Handlers | API Gateway (HTTP) + Lambda |
| Persistence | JSON file repo (`.data/db.json`) | DynamoDB single-table (+ GSIs) |
| Messaging | persisted + polling | same (realtime-ready model) |
| AI | deterministic analyzer | Amazon Bedrock |
| Auth | seeded dev session switcher | Amazon Cognito |
| Logs / notifications | structured logger · in-app notifications | CloudWatch · SNS (optional) |

---

## Local setup

**Prerequisites:** Node.js 20+ (built on Node 22) and npm. No AWS account required.

```bash
npm install
npm run seed      # load the UW demo community into .data/db.json
npm run dev       # http://localhost:3000
```

The profile menu (top-right) has a **dev user switcher** so you can act as different community members and see both sides of a request/offer/conversation.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run seed` | (Re)seed the UW demo data |
| `npm test` | Full test suite (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run eval` | AI/matching evaluation set with a measured report |

> **Tip:** if the dev UI ever looks stale/broken after many hot reloads, stop the server, `rm -rf .next`, and restart — Next's dev cache can occasionally corrupt.

---

## The visual identity

A warm, cohesive **sage & clay** palette (see [`product/design.md`](product/design.md)): muted sage-green as the grounding/structural color, a deep forest-olive shell that recedes beautifully over the map, warm linen-cream content surfaces, and a single **berry-rose** accent reserved for primary actions. Editorial **Fraunces** headlines paired with **Inter**. Custom SVG avatars, branded map markers, and reduced-motion-safe microinteractions (including a confetti **resolution celebration** when a contribution completes).

---

## The matching engine

Deterministic, pure, fully unit-tested (`src/domain/matching.ts`). Two phases:

1. **Hard eligibility (disqualifying):** availability, compatibility (directional port matching — a USB-C source needs a device that accepts USB-C *and* provides HDMI), time feasibility (travel + deadline / availability windows), radius, lending rules, owner≠requester, assistance-vs-item, exam-permission, and a **relevance gate** (no term overlap → not shown).
2. **Weighted score** over eligible candidates, normalized 0–1: semantic 0.30 · time 0.25 · location 0.20 · compatibility 0.15 · condition 0.10. Weights are tunable via `PATCH_MATCH_WEIGHTS`.

Walking times only show when both endpoints have coordinates; otherwise a disclosed zone approximation. Map coordinates are **privacy-jittered** (deterministic ~120 m offset) so pins sit in the right neighborhood without exposing exact locations.

## How the AI stays grounded

`request → interpret → retrieve → hard eligibility → rank → alternatives (from retrieved facts) → validated response.`

- Problem text is **untrusted data**, delimited in the prompt; the model extracts fields only and is told to ignore embedded instructions.
- Output is **strictly zod-validated** and discarded if malformed (falling back to the deterministic analyzer).
- Output **never** drives queries, authz, availability, or state. Alternatives only show if they map to real retrieved rows.
- A **concept/synonym layer** lets the deterministic analyzer understand intent ("Band-Aid/bleeding" → first-aid) without an LLM.
- A deterministic **safety guard** blocks clearly unsafe requests (e.g. impaired-driving assistance) with an honest refusal.

Run `npm run eval` for a measured report (13 realistic cases: exact/indirect/compatibility/time-critical/ambiguous/no-match/alternative/injection/unsafe). We **measure** rather than claim an accuracy number.

### Is Bedrock connected?

**Not in this environment.** The app runs on the deterministic analyzer by default and labels results **"Rule-based"** in the UI. The Bedrock adapter (`src/services/ai.bedrock.ts`) is implemented with strict output validation, timeout, bounded retry, and deterministic fallback. To activate it, see [AWS mode](#aws-mode-prerequisites--steps).

---

## PATCH Points (trust & integrity)

- Awarded **server-side, only on verified completion**: +15 to the lender when a loan completes, +25 to the helper when a community request resolves. Never for posting, asking, messaging, or clicking.
- **Idempotent**: each award is keyed to a unique underlying event (`eventType:eventId:userId`), so a repeated completion can't double-award. Concurrency-safe.
- Balances, badges, and milestones are **derived from the ledger** — there is no stored balance a user could tamper with.
- **Points are not a trust/safety signal.** A high balance never implies someone is verified or safe, and the UI says so.

---

## Messaging

Persisted conversations tied to a resource request or a community request, between exactly two participants. A conversation **opens the moment you offer help or request an item** (seeded with your note as the first message) and appears in both people's Messages tab — chat before any acceptance. Polling-based; the append-only message model is **realtime-ready** so a websocket/SSE layer can be added later without a rewrite. Authorization is enforced (participants only).

---

## Security & privacy

Designed in, not bolted on (full detail in [`product/security.md`](product/security.md)):

- Server-side authorization on every consequential action; the frontend never gates security.
- Private user data never exposed by public endpoints; **pickup instructions disclosed only after acceptance**; neighborhood-level + jittered map locations only.
- zod validation + content sanitization at every boundary; rate limiting + duplicate-submission guards.
- Atomic, availability-conditioned acceptance prevents double-booking; conditional offer acceptance prevents double-matching; idempotent point awards.
- No unverifiable claims ("verified users", "safe items", "guaranteed exchange"). Availability is last-known and reconfirmed on accept.

---

## Testing

```bash
npm test          # 113 tests: domain units + service/repository/messaging/points integration + eval
npm run typecheck
npm run lint
npm run build
```

Coverage highlights: input/schema validation, matching scores + hard constraints, compatibility & deadline feasibility, state transitions, authorization, alternative grounding, safety guard, prompt-injection handling, concurrency (double-booking **and** double-offer-accept), messaging authz + unread tracking, and **points idempotency** (a repeat resolution never double-awards). Live smoke scripts under `scripts/` exercise the API journeys (`smoke.mjs`, `smoke-community.mjs`, `smoke-messaging.mjs`, `smoke-offer-chat.mjs`).

---

## <a id="aws-mode-prerequisites--steps"></a>AWS deployment (prerequisites & steps)

Infrastructure-as-code lives in [`infra/`](infra) (AWS CDK, TypeScript): DynamoDB (+GSIs), a Lambda for business logic, an API Gateway HTTP API, a Cognito user pool, a private S3 bucket, CloudWatch log retention, an optional SNS topic, and least-privilege IAM (Bedrock limited to `InvokeModel` on one model ARN).

> **Status:** the stack is provided and designed to `cdk synth`. It has **not** been deployed here because no AWS credentials are configured.

**Prerequisites:** an AWS account + credentials; **Bedrock model access enabled** for your chosen model/region; `npx cdk bootstrap` once per account/region.

```bash
cd infra && npm install && npm run build
npx cdk synth
npx cdk deploy -c bedrockModelId=<model-id>
```

**Connect the app to AWS:**
```bash
npm i @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-bedrock-runtime
PATCH_PERSISTENCE=dynamo PATCH_AI_PROVIDER=bedrock \
PATCH_DDB_TABLE=<stack output> PATCH_BEDROCK_MODEL_ID=<model-id> AWS_REGION=<region> \
npm run build && npm start
```

Finding your Bedrock model id: in the Bedrock console → **Model access** (enable the model), then copy the **Model ID** (or the `us.`-prefixed inference-profile id for newer Claude models). See `.env.example` for all variables.

---

## Known limitations

- **Bedrock is not connected** in this environment; the AI runs on the deterministic analyzer (labeled "Rule-based").
- The CDK Lambda uses a placeholder handler; wiring the Next route handlers into a Lambda entrypoint (or container image) is the remaining step to run the backend on AWS. The domain logic is already AWS-ready behind the interfaces.
- Local persistence is a single JSON file (single-node demo); DynamoDB is the production path.
- Messaging is polling-based (structured for a later realtime upgrade).
- Map distance uses coordinates when present and a disclosed zone approximation otherwise; it is not a routing engine.
- Auth in local mode is a dev user switcher; Cognito replaces it in AWS mode with identical downstream authorization.
- Deferred by design: payments, deposits, reputation beyond points, image uploads (S3 is designed), multi-community admin.

---

## Demo

See [`product/demo-script.md`](product/demo-script.md). Quick version:

1. `npm run seed && npm run dev` → the home page opens on the **UW map** with the AI composer floating over it.
2. Submit the signature problem (USB-C ↔ HDMI, 15 min) → compatible available adapter ranked first; the reserved one and the HDMI-only cable are correctly ruled out; a hub alternative is offered.
3. Try **"I'm bleeding, need a Band-Aid"** → first-aid supplies (not an umbrella), with a gentle safety note.
4. **Ask the community** for something unlisted (e.g. "a pencil") → switch users → **offer help** → a conversation opens in Messages for both → chat → requester accepts → **resolve** → confetti + PATCH Points land.
5. Check the **leaderboard** on the home page → click a neighbor → see their **profile** (points, badges, shared resources).

All demo data is fictional and clearly labeled as the `campus-demo` community. Reset anytime via the profile menu (dev mode) or `npm run seed`.

---

## Project documents

- [`product/requirements.md`](product/requirements.md) — personas, journeys, requirements, acceptance criteria, scope.
- [`product/architecture.md`](product/architecture.md) — system design, data model, data flow, failure modes, deployment.
- [`product/design.md`](product/design.md) — visual system, UX, accessibility.
- [`product/security.md`](product/security.md) — authorization, privacy, prompt-injection resistance, threat model.
- [`product/implementation-plan.md`](product/implementation-plan.md) — milestones and status.
- [`product/demo-script.md`](product/demo-script.md) — the judge walkthrough.
