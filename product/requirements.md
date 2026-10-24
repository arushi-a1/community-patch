# PATCH — Requirements

> **PATCH** — *Your community, one solution away.*
> A hyperlocal, AI-powered, problem-first community platform. Hackathon theme: *Within Reach — solve what is close to you.*

This document defines the product requirements for the hackathon MVP. It records personas, journeys, functional and non-functional requirements, acceptance criteria, security requirements, MVP scope, and explicitly deferred features. Where a decision was ambiguous, a documented assumption is recorded inline as **[ASSUMPTION]**.

---

## 1. Problem statement

People constantly hit small, time-sensitive problems — a missing USB-C adapter, a calculator for an exam, an extra pair of hands to move tables. The resources to solve these problems usually already exist nearby; they are just invisible, hard to discover, or awkward to coordinate.

Marketplaces make you search for *products*. Lending apps make you browse *inventories*. Group chats make you guess *who to ask*. PATCH starts from a different question:

> **"What's going wrong, and how can we help you fix it?"**

A user describes a problem in plain language. PATCH interprets the underlying need, retrieves *real* resources from its database, filters out infeasible options with deterministic rules, ranks the feasible ones transparently, and helps the user connect with someone who can actually help.

---

## 2. Personas

| Persona | Description | Primary goals |
|---|---|---|
| **Maya — the organizer** | Runs a student club; sets up events and hits last-minute equipment gaps. | Fix an urgent problem (adapter/table/help) in minutes, not hours. |
| **Devin — the borrower** | Undergrad who occasionally needs a one-off item (calculator, screwdriver, umbrella). | Find a nearby, available, compatible item and arrange pickup quickly. |
| **Priya — the lender** | Owns useful items that sit idle; happy to help neighbors. | Publish resources, control availability, approve/decline requests safely. |
| **Sam — the helper** | Willing to offer physical assistance (carry boxes, set up tables). | Offer time-boxed assistance; be matched only when genuinely available. |
| **Dr. Lee — the community organizer** *(stretch)* | Oversees a community; wants visibility into unmet needs. | See common unmet resource needs; understand gaps. |

---

## 3. Core user journeys

### J1 — "I need a fix" (signature journey)
1. User lands on PATCH and sees the hero problem-input.
2. User types a natural-language problem (optionally adds location/deadline).
3. PATCH interprets the problem into a structured need.
4. PATCH retrieves real candidate resources and applies hard eligibility checks.
5. PATCH ranks feasible matches and shows up to 3 primary options with grounded explanations.
6. If the exact item is unavailable/incompatible, PATCH offers viable alternatives (clearly labeled).
7. User selects a solution and submits a borrowing/assistance request with time + pickup context + optional message.
8. Owner receives the request and accepts or declines; acceptance revalidates availability server-side.
9. Requester sees the updated status.

### J2 — Browse & discover
Browse resources, search by keyword, filter by category/availability/community, open details, request to borrow.

### J3 — Publish a resource
Create an item listing or an assistance offer with the full field set; manage its availability.

### J4 — Manage activity
Dashboard of outgoing requests, incoming requests, items awaiting response, active loans, completed/declined/cancelled.

### J5 — Lifecycle
Owner accepts/declines; either party cancels per rules; completion is confirmed explicitly; resource state stays consistent.

---

## 4. Functional requirements

**FR-1 Resource publishing.** Users can create item listings and assistance offers with: id, ownerId, title, description, resourceType (`ITEM` | `ASSISTANCE`), category, tags, condition, location, availabilityStatus, availabilityWindows (optional), lendingRules, pickupInstructions (restricted disclosure), imageRef (optional), compatibility attributes, timestamps.

**FR-2 Resource discovery.** Browse, keyword search, filter by category/availability/community, sort by relevance/proximity (proximity only when location data is reliable), view detail, request, save-for-later (time permitting).

**FR-3 Problem submission.** A natural-language input plus optional structured fields (location/community, deadline/urgency, request type, compatibility, notes). No long form required before searching.

**FR-4 Problem interpretation.** Produce a validated structured interpretation (`problem_summary`, `underlying_need`, `request_type`, `required_capabilities`, `item_constraints`, `compatibility_constraints`, `location_context`, `deadline`, `urgency`, `suggested_search_terms`, `possible_alternatives`, `clarifying_question`). Bedrock when configured; deterministic analyzer otherwise. Strict schema validation + sensible defaults. User text is untrusted; model output never drives queries/authz directly.

**FR-5 Resource retrieval.** Deterministic DB query over candidate resources based on the interpreted need (category/tags/semantic terms), scoped to the community.

**FR-6 Matching engine.** Hard eligibility checks first (availability, compatibility, time feasibility, radius, lending rules, owner≠requester for exclusive items). Then a normalized weighted score (semantic 30%, time 25%, location 20%, compatibility 15%, condition/suitability 10%). Weights configurable. Critical compatibility failure disqualifies rather than merely lowers score. No fabricated walking times.

**FR-7 Results presentation.** Up to 3 primary options: what it is, why it matches (grounded in DB fields), approximate location, availability, compatibility details, time estimate when reliable, stated assumptions/uncertainty, a clear next action.

**FR-8 Alternatives.** When the exact item is unavailable, suggest outcome-equivalent options checked against compatibility + availability. Label suggestions needing confirmation. Say so honestly when nothing viable exists.

**FR-9 Requests.** Create a request (resource, requested time, pickup context, optional message). Owner accepts/declines. States: `PENDING → ACCEPTED → COMPLETED`, plus `DECLINED`, `CANCELLED`. Transitions enforced server-side.

**FR-10 Concurrency safety.** Accepting a request for an exclusive item revalidates availability atomically; the same exclusive item cannot be promised to two borrowers.

**FR-11 Dashboard.** See outgoing/incoming/awaiting/accepted/active/completed/declined/cancelled with clear labels + timestamps.

**FR-12 Resource lifecycle.** States `AVAILABLE | RESERVED | BORROWED | UNAVAILABLE | ARCHIVED` with enforced transitions; cancellation/decline/overdue/completion never corrupt state.

**FR-13 Graceful degradation.** Core app (browse, publish, deterministic match, request lifecycle) remains fully usable when the AI service is unavailable.

**FR-14 Demo data + reset.** ≥30 diverse seed resources across conditions (available / unavailable / reserved / incompatible / available-later / out-of-radius), multiple fictional members, several pending/completed requests. A dev-only reset endpoint, unavailable in production.

**FR-15 Human assistance handling.** `ASSISTANCE` resources use assistance-specific availability and are never matched as physical items.

---

## 5. Non-functional requirements

- **NFR-1 Performance.** Initial interaction feels immediate. Browsing requires no AI call. Deterministic matching is fast for the MVP dataset. AI-assisted matching shows a clear loading state and returns promptly.
- **NFR-2 Responsive & accessible.** Excellent on desktop and mobile; WCAG-minded: focus states, keyboard nav, labeled controls, reduced-motion support, color contrast. *(Full WCAG conformance requires manual AT testing and expert review — not claimed.)*
- **NFR-3 Reliability.** Strict AI output validation, bounded input, timeouts, bounded retries, deterministic fallback. Idempotent critical state changes where practical.
- **NFR-4 Portability.** Persistence and AI behind interfaces; local adapters swappable for AWS without rewriting the UX.
- **NFR-5 Observability.** Structured logging of errors/latency server-side; design maps to CloudWatch in AWS mode.
- **NFR-6 Testability.** Unit + integration + primary-journey tests; type-check, lint, build all pass.

---

## 6. Security & privacy requirements

- **SR-1** Authorization + ownership checks for every consequential action (server-side; never trust the client).
- **SR-2** Private user info by default; no public display of contact details.
- **SR-3** Minimal disclosure of pickup instructions — revealed only after a request is accepted.
- **SR-4** No exact home addresses on public cards; show neighborhood-level location only.
- **SR-5** Rate limiting on request creation and AI calls where feasible.
- **SR-6** Validate and sanitize all user-generated content.
- **SR-7** Prompt-injection resistance: model output is data, never instructions; it cannot reserve, accept, change availability, or bypass permissions.
- **SR-8** No secrets in frontend or repo; `.env.example` holds placeholders only; IAM roles for deployed workloads.
- **SR-9** Internal errors never leaked to users.
- **SR-10** No unverifiable claims (no "verified users", "safe items", or "guaranteed exchange").

---

## 7. Acceptance criteria (selected)

- **AC-1** Submitting the signature scenario (USB-C↔HDMI, 15 min, student union) returns a compatible, currently-available adapter/hub with a grounded explanation; a reserved-but-compatible adapter is **never** shown as available.
- **AC-2** "Calculator for an exam this afternoon" returns available calculators and does not assume every calculator is exam-permitted.
- **AC-3** "Need another pair of hands in 20 minutes" returns `ASSISTANCE` listings, respects availability, and never returns item loans.
- **AC-4** With the AI adapter disabled, the full journey (submit → match → request → accept) still works via the deterministic analyzer.
- **AC-5** Two concurrent accepts for the same exclusive item result in exactly one ACCEPTED; the other fails cleanly.
- **AC-6** A user cannot accept/decline/modify a resource or request they do not own.
- **AC-7** A prompt-injection payload in the problem text cannot change query scope, authz, or state.
- **AC-8** Empty searches, invalid input, and AI failures each render a helpful, non-crashing state.

---

## 8. MVP scope (in)

Design system + app shell; local-first persistence with seed data; resource browse/search/filter/detail; resource publishing + availability management; "I need a fix" flow (interpret → retrieve → rank → present → alternatives); request lifecycle with concurrency-safe acceptance; activity dashboard; deterministic matching engine; AI adapter (Bedrock) with deterministic fallback; security/authz/validation; unit + integration + journey tests; demo seed + dev-only reset; AI evaluation set.

## 9. Explicitly deferred (out)

Payments, deposits, reputation systems, public social feeds, DM infrastructure, complex scheduling calendars, multi-agent orchestration, predictive analytics, native mobile apps, multi-community admin hierarchies, image **uploads** (image *reference* is supported; S3 upload is a documented stretch).

## 10. Documented assumptions

- **[ASSUMPTION]** Single demo community (`campus-demo`) for the MVP; schema carries `communityId` so multi-community is a data change, not a rewrite.
- **[ASSUMPTION]** No AWS credentials in the dev environment → app runs fully in **local mode** by default; AWS adapters are implemented/designed and documented but inactive until configured.
- **[ASSUMPTION]** Location is modeled as a named place with a coarse `zone` + optional lat/lng. Walking-time is only shown when lat/lng exist for both ends; otherwise a disclosed zone-based approximation is used.
- **[ASSUMPTION]** Auth in local mode uses a simple seeded-session "act as user" switcher (clearly a dev affordance) so journeys are demonstrable without Cognito; the authorization *logic* is identical and real.

---

## Post-MVP scope delivered (beyond this original spec)

This document captured the original borrowing MVP. The shipped product extends well past it into a full community platform. Delivered and verified:

- **Interactive community map** (Leaflet/OSM, UW-Seattle, privacy-jittered pins) as the home-page hero.
- **Open community requests** — post "I need X" with no matching listing; nearby neighbors are notified and can **offer help**; requester accepts (concurrency-safe); resolve.
- **Persisted messaging** — conversations open the moment you offer/request; participants-only; polling; realtime-ready.
- **In-app notifications** — nearby-request, new-offer, accepted, resolved, points.
- **PATCH Points** — verified-only, idempotent, server-validated ledger; badges; community milestones; `/points` page; landing-page leaderboard; public profiles (`/u/[id]`).
- **Resource editing**, clickable member profiles everywhere, a sage & clay visual identity, and a resolution celebration.
- **AI intent layer** — concept/synonym understanding (e.g. first-aid) + safety guard, raising the eval set to 13/13.

See `implementation-plan.md` (M12–M17) for the milestone detail and `README.md` for the current feature list and honest limitations (notably: Bedrock not connected in this environment; local JSON persistence with a designed DynamoDB adapter).
