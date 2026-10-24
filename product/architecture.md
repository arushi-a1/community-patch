# PATCH — Architecture

## 1. Overview

PATCH is a **local-first, cloud-ready** TypeScript application. The same application code runs in two modes selected by environment variables:

- **Local mode (default):** Next.js App Router with Route Handlers as the backend; a JSON-file-backed repository; a deterministic AI analyzer. No AWS credentials required.
- **AWS mode (documented/designed):** the same domain logic runs in Lambda behind API Gateway; DynamoDB for persistence; Amazon Bedrock for interpretation/alternatives; Cognito for auth; S3 for images; CloudWatch for logs/metrics; SNS for optional notifications.

The crucial design property: **domain logic, persistence, and AI are each behind interfaces.** Swapping local adapters for AWS adapters does not touch the UI or the business rules.

```
┌──────────────────────────────────────────────────────────────┐
│                         Next.js (React)                        │
│   App shell · Discover · I-Need-a-Fix · Activity · Resources   │
└───────────────┬────────────────────────────────────────────────┘
                │ fetch (typed client)
┌───────────────▼────────────────────────────────────────────────┐
│          API layer  (Next Route Handlers  ⇄  Lambda)            │
│   zod-validated boundaries · authz · rate limiting · errors     │
└───────┬───────────────────────┬───────────────────────┬────────┘
        │                       │                       │
┌───────▼───────┐     ┌─────────▼─────────┐     ┌────────▼────────┐
│  Domain core  │     │   Persistence     │     │   AI service    │
│ matching ·    │◄───►│  Repository iface │     │  AIService iface│
│ lifecycle ·   │     │  Local JSON  /    │     │  Local analyzer │
│ authz rules   │     │  DynamoDB adapter │     │  / Bedrock      │
└───────────────┘     └───────────────────┘     └─────────────────┘
```

## 2. Technology stack

| Concern | Local mode | AWS mode |
|---|---|---|
| UI | Next.js 15 (App Router) + React 19 + TypeScript | same (static export or Amplify/CloudFront) |
| Styling | Tailwind CSS v4 | same |
| Icons | lucide-react | same |
| Validation | zod | same |
| API | Next Route Handlers | API Gateway + Lambda |
| Persistence | JSON file repo (`.data/`) | DynamoDB (single-table) |
| AI | deterministic analyzer | Bedrock (`@aws-sdk/client-bedrock-runtime`) |
| Auth | seeded dev session | Cognito |
| Tests | Vitest + Testing Library | same |
| Logs | structured console logger | CloudWatch |

## 3. Module layout

```
src/
  domain/            # pure, framework-free business logic (100% unit-testable)
    types.ts           # Resource, Request, User, enums, Interpretation schema
    matching.ts        # hard constraints + weighted scoring (configurable weights)
    lifecycle.ts       # resource & request state machines + guards
    authz.ts           # authorization decisions
    interpretation.ts  # zod schema + deterministic analyzer + sanitization
    alternatives.ts    # grounded alternative generation (uses retrieved facts)
    config.ts          # matching weights, radii, timeouts
  services/
    repository.ts      # Repository interface
    repository.local.ts# JSON-file adapter (atomic writes, conditional updates)
    repository.dynamo.ts# DynamoDB adapter (designed; guarded behind env)
    ai.ts              # AIService interface
    ai.local.ts        # wraps deterministic analyzer
    ai.bedrock.ts       # Bedrock adapter (guarded behind env)
    container.ts       # selects adapters from env (local vs aws)
    session.ts         # current-user resolution (dev switcher / Cognito)
    rateLimit.ts       # token-bucket limiter
    logger.ts          # structured logger
  app/                 # Next.js routes (UI + API route handlers)
  components/          # design-system + feature components
  seed/                # deterministic seed data + loader
```

## 4. Data flow — "I need a fix"

1. **Submit** → `POST /api/fixes/analyze` with `{ text, location?, deadline?, requestType? }`.
2. **Sanitize + bound** input (length caps, strip control chars).
3. **Interpret** via `AIService.interpret()` → validated `Interpretation` (zod). On AI failure/timeout → deterministic analyzer. *Model output is data only.*
4. **Retrieve** candidates deterministically from the repository using `suggested_search_terms`/category/tags, scoped to community.
5. **Hard eligibility** (`matching.ts`): availability, compatibility (disqualifying), time feasibility, radius, lending rules, owner≠requester, assistance-vs-item.
6. **Score** eligible candidates (weighted, normalized 0–1). Return top N (default 3).
7. **Alternatives** (`alternatives.ts`): outcome-equivalent candidates from the *retrieved* set, checked for compatibility/availability, labeled if they need confirmation.
8. **Respond** with grounded explanations referencing real resource fields + computed score components.

`POST /api/fixes/match` can run steps 4–7 directly from a known interpretation (used by tests and the "refine" action) so the UI never needs multiple sequential model calls.

## 5. API surface

| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/resources` | public (community-scoped) | list + filters + pagination |
| `POST /api/resources` | owner (self) | create; validated |
| `GET /api/resources/:id` | public | detail; pickup instructions hidden |
| `PATCH /api/resources/:id` | owner only | update/availability |
| `POST /api/fixes/analyze` | session | NL → interpretation (+ match) |
| `POST /api/fixes/match` | session | interpretation → ranked matches |
| `POST /api/requests` | session | create (rate-limited, dedup) |
| `GET /api/requests` | session | scoped to current user |
| `GET /api/requests/:id` | participant only | |
| `POST /api/requests/:id/accept` | resource owner | revalidates availability atomically |
| `POST /api/requests/:id/decline` | resource owner | |
| `POST /api/requests/:id/cancel` | requester or owner | per lifecycle rules |
| `POST /api/requests/:id/complete` | participant | explicit confirmation |
| `POST /api/dev/reset` | dev mode only | re-seed; 404 in production |

Every handler: zod-validated input, explicit authz, typed response, mapped error codes (`400/401/403/404/409/429/500`), no internal leakage.

## 6. Data model (DynamoDB single-table design — AWS mode)

Table `patch` with `PK`/`SK` and GSIs. Local adapter mirrors the same access patterns over JSON.

| Entity | PK | SK | Notes |
|---|---|---|---|
| User | `USER#<id>` | `PROFILE` | private fields not projected to public reads |
| Resource | `COMMUNITY#<cid>` | `RESOURCE#<id>` | list-by-community/category via GSI1 |
| Resource (by owner) | GSI1 `OWNER#<uid>` | `RESOURCE#<id>` | a user's resources |
| Resource (by category) | GSI2 `CAT#<cid>#<category>` | `RESOURCE#<id>` | filtered browse |
| Request (by requester) | `USER#<uid>` | `REQ#<id>` | outgoing |
| Request (by owner) | GSI3 `OWNER#<uid>` | `REQ#<id>` | incoming |
| Request (by resource) | GSI4 `RESOURCE#<rid>` | `REQ#<id>` | conflict checks |

**Access patterns covered:** list resources by community/category; get one resource; a user's published resources; requests by requester; incoming requests for an owner; requests on a resource (conflict detection); consistent state updates.

**Consistency:** acceptance uses a DynamoDB `TransactWriteItems` — a conditional update on the resource (`availabilityStatus = AVAILABLE`) plus the request status change — so an exclusive item can't be double-promised. The local adapter emulates this with a per-resource mutex + conditional check, giving identical semantics in tests.

*Rationale for single-table:* the access patterns are relationship-heavy (requests join users↔resources) and bounded; a single table with 4 GSIs serves all of them without scans. Multiple tables would duplicate the same keys and complicate the transactional accept.

## 7. Failure modes & handling

| Failure | Handling |
|---|---|
| AI unavailable / timeout / invalid output | fall back to deterministic analyzer; UI labels results as rule-based; journey continues (FR-13) |
| Concurrent accepts | conditional transaction / mutex → exactly one wins; other gets `409` (AC-5) |
| Prompt injection in problem text | model output validated + treated as data; never drives queries/authz (SR-7, AC-7) |
| No feasible match | explain why + show alternatives or an honest "no confirmed match" (FR-8) |
| Invalid input | `400` with field errors; UI inline validation |
| Rate limit exceeded | `429` with retry hint |
| Repository write conflict | surfaced as `409`; no partial state |
| Unexpected error | logged server-side; generic `500` to client (SR-9) |

## 8. Deployment approach (AWS mode)

- IaC via **AWS CDK** (TypeScript) — one stack: DynamoDB table + GSIs, Lambda functions, API Gateway HTTP API, Cognito user pool, S3 bucket (private), CloudWatch log groups, least-privilege IAM, optional SNS topic.
- Bedrock access via an IAM role scoped to `bedrock:InvokeModel` for the chosen model only.
- The CDK app is provided and documented; it is **not deployed** here because no AWS credentials are available. `README` + `product/security.md` document exactly what's required to deploy.

---

## Community platform: entities, services & endpoints

The full platform (open requests, messaging, points, profiles, map) uses the same local-first / AWS-ready, interface-driven architecture described above.

### New domain entities
- **CommunityRequest** — an open "I need X" post not tied to a listed resource. States `OPEN → MATCHED → RESOLVED` (+ `CANCELLED`, `EXPIRED`). Carries a coarse `location` for proximity + map.
- **Offer** — a helper's response to a community request. States `PENDING → ACCEPTED/DECLINED` (+ `WITHDRAWN`). One accepted offer per request, enforced by a conditional/atomic accept.
- **Notification** — persisted, in-app, per recipient; fetched on load/poll (no push infra).
- **Conversation** + **Message** — persisted messaging tied to a request or community request; exactly two participants; append-only messages (realtime-ready).
- **PointTransaction** — append-only points ledger; idempotency id `eventType:eventId:userId`.

### New services
- `communityRequestService` — create/offer/accept/decline/resolve/cancel with authz + lifecycle + nearby-notification fan-out.
- `messagingService` — open (idempotent per participant pair), send, read-tracking, participants-only authz. Opens a conversation on offer/request, seeded with the first message.
- `pointsService` — `awardPoints` (idempotent), derived user summary (balance/badges/next), community impact (totals, milestones, leaderboard).
- `domain/geo.ts` — privacy-safe deterministic coordinate jitter for map display.
- `domain/concepts.ts` — concept/synonym intent layer for the deterministic analyzer.
- `domain/safety.ts` — deterministic unsafe-request guard.
- `serviceResult.ts` — shared `ServiceResult`/`ok`/`err` (extracted to avoid service import cycles).

### New API endpoints
- `GET/POST /api/community-requests`, `GET /api/community-requests/:id`, `POST …/offers`, `…/resolve`, `…/cancel`; `POST /api/offers/:id/accept|decline`.
- `GET/POST /api/notifications`.
- `GET/POST /api/conversations`, `GET /api/conversations/:id`, `POST …/messages`.
- `GET /api/points`; `GET /api/users/:id` (public profile).
- `GET /api/map` (markers; single-pass, privacy-jittered).
- `PATCH /api/resources/:id` now backs a real edit UI.

### DynamoDB single-table extensions (AWS mode, designed)
Community requests, offers, notifications, conversations/messages, and point transactions are modeled on the same table with new PK/SK patterns and reuse of GSI1–GSI4 (e.g. requests carry `GSI2PK = COMMUNITY#<cid>#REQ` for single-pass community reads; point transactions use a conditional put on `attribute_not_exists(PK)` for idempotency; offer acceptance uses `TransactWriteItems` conditioned on the request still being `OPEN`).

### Performance notes
- Map/impact/feed reads are single-pass (`listAllRequests`, `listCommunityRequests`, `listAllPointTransactions`) rather than per-user N+1 loops. The legacy `/api/community` feed endpoint was removed.
- Live views (map, messages, notifications, leaderboard) use lightweight polling; browsing and matching require no AI call.
