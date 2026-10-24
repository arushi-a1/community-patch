# PATCH — Implementation Plan

Small, verifiable milestones. After each: run tests, type-check, lint, build; fix regressions; verify in the browser where applicable; then update this file's status.

Status legend: ⬜ not started · 🟡 in progress · ✅ done

## Smallest coherent end-to-end MVP
Home → submit a problem → deterministic interpretation + retrieval + ranked matches → open a resource → submit a request → owner accepts (availability revalidated) → requester sees updated status. Everything runs locally with seed data and **no AWS**. AI (Bedrock) and DynamoDB are additive adapters behind the same interfaces.

## Milestones

### M1 — Foundation & design system ✅ (Next 15 + Tailwind v4 + lucide + zod + Vitest; shell, tokens, UI primitives; build green)
- Scaffold Next.js (App Router, TS) + Tailwind v4 + lucide + zod + Vitest.
- Design tokens, base styles, app shell (top nav + mobile tab bar), core UI primitives (Button, Badge, Card, Input, Dialog, Toast, Skeleton).
- **Verify:** dev server renders shell; `typecheck`, `lint`, `build`, empty test run all pass.

### M2 — Domain core (pure, framework-free) ✅ (58 unit tests pass)
- `types.ts`, `config.ts`, `interpretation.ts` (zod + deterministic analyzer + sanitizer), `matching.ts` (hard constraints + weighted scoring), `lifecycle.ts` (state machines), `authz.ts`, `alternatives.ts`.
- **Verify:** unit tests for validation, scoring, hard constraints, compatibility, deadline feasibility, transitions, authz, alternatives, injection sanitization.

### M3 — Persistence & seed ✅ (local + dynamo adapters, 35 seed resources, 6 integration tests pass incl. concurrency)
- `Repository` interface + local JSON adapter (atomic writes, conditional update, per-resource mutex). `container.ts`, `session.ts`, `logger.ts`, `rateLimit.ts`.
- Deterministic seed: ≥30 diverse resources across all conditions + multiple users + pending/completed requests. Dev-only reset.
- **Verify:** integration tests for create/get resource; seed loads; reset guarded.

### M4 — Resource browsing ✅ (GET /resources + filters/pagination + detail; Discover page; verified 200 live)
- `GET /api/resources` (+ filters/pagination), `GET /api/resources/:id`; Discover page + resource cards + detail; empty states + skeletons.
- **Verify:** browse/filter/detail in browser; API integration tests.

### M5 — Publish & availability ✅ (POST/PATCH /resources; publish form; My Resources availability controls; owner authz tested)
- `POST /api/resources`, `PATCH /api/resources/:id`; publish form; My Resources with availability controls; authz enforced.
- **Verify:** create + edit availability; unauthorized edit blocked (test).

### M6 — I-need-a-fix (deterministic) ✅ (analyze/match endpoints + results UI; signature/calculator/assistance verified; reserved & incompatible excluded)
- `POST /api/fixes/analyze` + `/match`; results UI (recap, primary cards, grounded explanations, alternatives, honest empty state).
- **Verify:** signature + calculator + assistance scenarios return feasible matches; reserved-but-compatible never shown available.

### M7 — Request lifecycle & concurrency ✅ (create/accept/decline/cancel/complete; atomic accept; dedup; concurrency test proves exactly-one ACCEPTED; live journey verified)
- `POST /api/requests`, list, detail, accept/decline/cancel/complete; atomic accept; dedup; rate limit.
- **Verify:** full lifecycle; concurrent-accept test yields exactly one ACCEPTED; authz tests.

### M8 — Activity dashboard ✅ (Incoming/Outgoing/Active/History tabs; privacy-conscious community feed; pickup hidden until accepted, verified live)
- My Activity tabs (Incoming/Outgoing/Active/History); community recent-requests feed (privacy-conscious).
- **Verify:** states + timestamps render; pickup hidden until accepted.

### M9 — AI (Bedrock) adapter + fallback ✅ (Bedrock adapter w/ strict validation + timeout + bounded retry + deterministic fallback; safety guard; eval set 12/12)
- `ai.bedrock.ts` behind env flag; strict output validation; timeout + bounded retry; deterministic fallback; evaluation set + runner.
- **Verify:** fallback path works with AI disabled (default); eval set runs and reports; injection cases handled.

### M10 — Security, a11y, error handling, polish ✅ (rate limits, validation, error mapping, minimal disclosure, focus/keyboard/reduced-motion/aria-live; quality gates green)
- Rate limits, validation, error mapping, minimal disclosure wired through; a11y pass (focus, keyboard, reduced-motion, aria-live); visual polish; perf pass (pagination, no AI on browse).
- **Verify:** quality gates (typecheck/lint/build/tests) green; primary journey verified end to end.

### M11 — Deployment prep & docs ✅ (CDK stack synths to valid CloudFormation; .env.example; professional README; NOT deployed — no AWS creds)
- AWS CDK stack (DynamoDB+GSIs, Lambda, API GW, Cognito, S3, CloudWatch, SNS, least-priv IAM) — provided, **not deployed** (no creds). `.env.example`, professional README, this plan finalized.
- **Verify:** CDK `synth` is designed to run with deps; README reproduces local setup from scratch.

## Verification commands
```
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest run
npm run build       # next build
npm run seed        # (re)generate local seed data
npm run eval        # AI/matching evaluation set
```

## Progress log
- All 11 milestones complete and verified.
- Quality gates (final): `tsc --noEmit` clean · ESLint clean · **86/86 tests pass** · `next build` succeeds · eval **12/12** · CDK `synth` produces a valid template.
- Live end-to-end journey verified against the running dev server via `scripts/smoke.mjs` (submit → match → request → accept → pickup disclosed → complete; authz 403s; concurrency-safe).
- Not done (documented): wiring the Next route handlers into a Lambda entrypoint for actual AWS deploy; no AWS credentials in this environment, so the stack was synthesized but not deployed.

---

## Post-MVP milestones (built after the original 11)

These extended the product well beyond the borrowing MVP into a full community platform. All complete and verified.

### M12 — AI correctness: concept/intent layer ✅
- `src/domain/concepts.ts` maps everyday language → canonical concepts (e.g. "Band-Aid/bleeding" → first-aid supplies, "loose screw" → a tool), fixing the keyword-matching gap. Added quantity extraction + a deterministic safety guard. Eval grew to 13/13.

### M13 — Interactive map ✅
- Leaflet + react-leaflet (v5, React 19), OpenStreetMap tiles, UW-Seattle localized with real coordinates. Branded markers by type, detail panel, filters, synced list, geolocation, graceful tile-failure fallback. Privacy-jittered approximate coordinates (`src/domain/geo.ts`). Map is the home-page hero with the AI composer overlaid.

### M14 — Open community requests + notifications ✅
- `CommunityRequest` + `Offer` entities, lifecycle + authz (`src/domain/communityRequests.ts`), concurrency-safe offer acceptance, nearby-zone notification fan-out, in-app notification bell. Post "I need X" that isn't a listed resource; neighbors offer; requester accepts; resolve.

### M15 — Messaging ✅
- Persisted conversations (`src/services/messagingService.ts`) tied to a request/community-request, participants-only authz, unread tracking, optimistic send, polling, realtime-ready model. Conversations open on first contact (offer/request), seeded with the first message.

### M16 — PATCH Points, badges, milestones, profiles, leaderboard ✅
- Idempotent, server-awarded point ledger (`src/domain/points.ts`, `src/services/pointsService.ts`): +15 loan complete, +25 community-request resolved. Derived balances/badges/milestones. `/points` page, landing-page leaderboard, public `/u/[id]` profiles, resolution celebration (confetti). Avatars + clickable names throughout.

### M17 — Visual identity + polish + optimization ✅
- Sage & clay palette, Fraunces display font, custom avatars/markers/illustrations, card depth, reduced-motion-safe motion. Resource editing (reused form). Removed an N+1 community-feed endpoint; map/impact reads are single-pass. Clickable profiles everywhere.

## Final status
- **113 tests pass** · eval **13/13** · `typecheck`, `lint`, `build` all clean.
- Live-verified journeys: fix→match→request→accept→complete (+points), ask-community→offer→chat→accept→resolve (+points+confetti), messaging authz, leaderboard→profile, resource edit.
- Still open (documented): Bedrock not connected in this environment (deterministic analyzer, labeled "Rule-based"); CDK Lambda handler is a placeholder; local JSON persistence (DynamoDB adapter designed).
