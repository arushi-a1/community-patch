# PATCH — Security & Privacy

Security is designed into the application, not bolted on. This document maps each requirement to its implementation.

## 1. Authorization model

- **Every consequential action is authorized server-side** in `domain/authz.ts`; the frontend never gates security (it only hides irrelevant controls for UX).
- Decisions are pure functions of `(actor, target, action)`:
  - `PATCH /resources/:id`, publish updates → **owner only**.
  - `accept` / `decline` → **resource owner only**.
  - `cancel` → **requester or owner**, subject to lifecycle rules.
  - `complete` → **a participant** (requester or owner).
  - `GET /requests/:id` → **participant only**.
- Owners cannot borrow their own **exclusive** item through the public request flow.
- In AWS mode the actor identity comes from a **Cognito**-verified JWT; in local mode from a seeded dev session (the *logic* is identical).

## 2. Privacy & minimal disclosure

- User contact details are **never** returned by public endpoints; only display names.
- **Pickup instructions** are withheld until a request reaches `ACCEPTED`, and only to the two participants.
- Public resource cards show **neighborhood/zone**, never an exact address.
- Recent-community-requests feed shows title + category + relative time only — no requester identity or contact.

## 3. Input validation & content safety

- All request bodies are validated with **zod** at the boundary; unknown fields rejected, lengths bounded.
- User-generated text is sanitized (control-character stripping, length caps) before storage and before being embedded in any prompt.
- Resource/request state transitions are validated against explicit state machines; illegal transitions return `409`.

## 4. Prompt-injection resistance (AI safety)

- The user's problem text is treated as **untrusted data**, wrapped and clearly delimited in the prompt; the system prompt instructs the model to extract fields only and ignore any embedded instructions.
- The model returns JSON that is **strictly validated** against the `Interpretation` zod schema; unknown or malformed output is discarded and the deterministic analyzer is used.
- **Model output never drives privileged behavior**: it cannot change query scope, authorization, availability, or state. It only produces search hints and candidate alternative *names*, which are then re-grounded against the retrieved database rows.
- Alternatives suggested by the model are only shown if they correspond to **real retrieved resources** that pass compatibility/availability checks.

## 5. Rate limiting & abuse controls

- Token-bucket limiter (`services/rateLimit.ts`) on **request creation** and **AI analyze** per actor/IP.
- Duplicate-submission guard: identical `(requester, resource, requestedTime)` within a short window is de-duplicated (idempotency).
- Bounded AI input size; request timeout; bounded retries (no infinite retry).

## 6. Concurrency & state integrity

- Accepting a request for an exclusive resource performs an **atomic conditional update**:
  - AWS: DynamoDB `TransactWriteItems` conditioned on `availabilityStatus = AVAILABLE`.
  - Local: per-resource mutex + conditional check.
- Result: an exclusive item cannot be promised to two borrowers; the losing accept returns `409`.
- Critical state changes are idempotent where practical (completing an already-completed request is a no-op success).

## 7. Secrets & configuration

- **No secrets in the repository or frontend.** `.env.example` contains placeholders only; real values live in untracked `.env.local` (git-ignored) or, in AWS, in the Lambda execution role / SSM.
- Deployed workloads use **IAM roles**, not long-lived keys. Bedrock access is scoped to `bedrock:InvokeModel` on the specific model ARN.
- S3 (images, stretch) uses a **private** bucket with validated, size-limited, content-type-restricted uploads via short-lived pre-signed URLs.

## 8. Error handling & disclosure

- Internal errors are logged server-side (structured logger → CloudWatch in AWS mode) and returned to the client as generic messages with a stable error code — **no stack traces or internal details leak**.

## 9. Honesty constraints

The product must not claim what it cannot verify:
- No "verified users", no "guaranteed safe items", no "guaranteed exchange".
- Availability is always the *last-known* state; acceptance revalidates. Cached availability is never presented as a current guarantee.
- Walking times are shown only when reliable coordinates exist; otherwise a disclosed approximation or none.

## 10. Threat model summary

| Threat | Mitigation |
|---|---|
| Unauthorized state change | server-side authz on every action (§1) |
| PII leakage | minimal-disclosure responses, no contact in public reads (§2) |
| Injection via problem text | data-not-instructions prompt + strict output validation + re-grounding (§4) |
| Double-booking | atomic conditional accept (§6) |
| Request spam / abuse | rate limits + dedup (§5) |
| Secret exposure | no secrets in repo/frontend; IAM roles (§7) |
| Information leak via errors | generic client errors + server logs (§8) |

*Not in scope for the MVP (documented, deferred): payments/escrow fraud, identity verification, formal reputation/dispute adjudication.*

---

## Post-MVP security surfaces

The new features extend the same model — server-side authorization, minimal disclosure, idempotency, and concurrency safety.

### Community requests & offers
- Offering is denied for the requester on their own request and for non-community members. Only the **requester** accepts/declines offers and resolves/cancels; a helper may withdraw only their own pending offer; resolve is allowed for the requester or the accepted helper.
- **Offer acceptance is atomic and conditional** on the request still being `OPEN`, so two simultaneous accepts can't both match (mirrors the resource double-booking guarantee). Tested.

### Messaging
- A conversation has exactly two participants; **only participants** may read or post (enforced on open, read, and send). Participants are derived from the underlying context (requester + owner, or requester + a specific offerer) — a user can't fabricate access to a thread they aren't part of. Message length bounded; send is rate-limited.

### PATCH Points
- Awards are **server-side only**, fired solely on verified completions (loan completed / community request resolved). Never for posting, requesting, messaging, or clicking.
- **Idempotent**: deterministic transaction id (`eventType:eventId:userId`) + conditional insert / per-ledger lock means a repeated completion can't double-award. Balances are **derived** from the ledger, never stored client-side — a user cannot edit their own balance or award themselves points.
- Points are explicitly **separated from trust/safety**; the UI states a high balance does not imply verification or safety.

### Notifications & profiles
- Notifications are per-recipient; a user only ever reads their own.
- Public profiles (`/api/users/:id`) return display name, points, badges, and shared resources only — no email/contact; pickup instructions remain withheld.

### Map privacy
- Coordinates are **deterministically jittered** (~120 m) for display and never exact; pickup details are still gated to accepted participants. Resources without coordinates are returned with `point: null` rather than an invented position.
