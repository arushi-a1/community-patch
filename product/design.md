# PATCH — Design (UX & Visual System)

## 1. Design principles

Trust · Speed · Resourcefulness · Community · Calm competence · Approachability.

PATCH should read like a polished consumer product from a strong product team — *not* a generic AI startup. No gradient soup, no glowing purple cards, no robot mascots, no gratuitous "AI" branding. AI is a capability, not a theme.

## 2. Visual identity

### Color
Warm off-white canvas; deep forest green for text/nav; a restrained energetic green for primary actions; warm amber used sparingly for secondary accents.

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#FAF9F5` | app background (warm off-white) |
| `--surface` | `#FFFFFF` | cards/surfaces |
| `--ink` | `#1C2B24` | primary text / nav (deep forest charcoal) |
| `--ink-soft` | `#4A5B52` | secondary text |
| `--line` | `#E7E3DA` | subtle borders |
| `--brand` | `#1E7A4D` | forest green (brand) |
| `--accent` | `#27B06A` | energetic green (primary action) |
| `--accent-weak` | `#E8F6EE` | accent tint (chips, highlights) |
| `--amber` | `#D9893B` | warm secondary accent (sparingly) |
| `--amber-weak`| `#FBEFE0` | amber tint |
| `--danger` | `#C0442E` | destructive/decline |
| `--focus` | `#1E7A4D` | focus ring |

All pairings target WCAG AA contrast for text. Dark variants reserved as a stretch goal.

### Typography
Modern readable sans-serif: **Inter** (via `next/font`), with a tighter display weight for headings. Clear hierarchy, generous line height.

- Display: 32–44px / 600
- H2: 22–26px / 600
- Body: 15–16px / 400–500
- Meta: 13px / 500, `--ink-soft`

### Shape, depth, motion
- Corner radii: `8px` controls, `14px` cards, `999px` pills.
- Borders: 1px `--line`; soft shadow `0 1px 2px rgba(28,43,36,.06), 0 8px 24px -16px rgba(28,43,36,.18)`.
- Motion: 120–200ms ease; subtle; **respects `prefers-reduced-motion`** (transitions disabled).
- Spacing scale: 4/8/12/16/24/32/48. Generous whitespace; avoid deep card nesting.

### Icons
`lucide-react` throughout (plug, battery, calculator, umbrella, wrench, table, hand-helping, etc.). Emoji are never primary UI icons.

## 3. App shell

- **Top nav:** PATCH wordmark (leaf + patch motif) · nav links **Discover · Community · My Activity · My Resources** · a prominent **"Request a fix"** primary button · profile menu (dev user switcher in local mode).
- **Mobile:** sticky bottom tab bar (Discover · Fix · Activity · Resources) with the Fix action centered and emphasized — easy one-handed reach. Top bar collapses to wordmark + profile.
- Content max-width ~1120px, comfortable gutters.

## 4. Key screens

### Home / dashboard
- **Hero:** heading *"Something came up? Let's fix it."* · sub *"Find the people, things, and resources around you that can help."* · a large problem input pre-filled with the example *"Our event starts in 15 minutes, and we need a USB-C adapter."* · primary CTA **Find a fix** · secondary **Browse nearby resources**.
- Below hero: **Nearby resources** (small, genuinely useful set) · **Recent community requests** (privacy-conscious: title + category + relative time, never contact info) · **How PATCH works** (3 concise steps). No empty-dashboard feel.

### I-need-a-fix results
- Sticky recap of the interpreted need (summary + chips for deadline/location/compatibility) with an "edit" affordance.
- Up to 3 **primary match cards**, each: solution title · *why it matches* (grounded bullet list from real fields + score components) · location (neighborhood) · availability badge · compatibility notes · time-to-obtain *(only when reliable)* · assumptions/uncertainty line · **Request this** action.
- **Alternatives** section, visually distinct, each labeled *"needs confirmation"* when applicable.
- Honest empty state when nothing is feasible, with a "broaden search" control.

### Resource card (reused on Discover + results)
At a glance: type/category icon · title · photo or cohesive colored placeholder (layout never depends on remote images) · neighborhood · availability badge · "borrow now" eligibility · key compatibility chip · distance/walk estimate when reliable · primary action.

### Discover
Search bar · category filter chips · availability filter · sort (relevance/proximity) · responsive grid · skeletons while loading · helpful empty state with "broaden search".

### Resource detail
Full description, compatibility attributes, lending rules, availability, owner (display name only — no contact), **Request** CTA. Pickup instructions hidden until a request is accepted.

### Publish resource
Short, friendly form: type toggle (Item / Assistance), title, description, category, tags, condition, location (named place + zone), availability, lending rules, compatibility attributes, optional image reference. Assistance hides item-only fields (condition/compatibility) and shows availability windows.

### My Activity
Tabs: **Incoming** (needs response) · **Outgoing** · **Active** · **History**. Each request row: resource, counterpart (display name), requested time, status pill, timestamps, contextual actions (Accept/Decline/Cancel/Complete). Pickup details appear only after acceptance.

## 5. Microinteractions & states
Clear focus/hover states · loading spinners on async actions · skeletons for lists · optimistic updates only where safely reversible (e.g., save-for-later) · confirm dialogs for consequential actions (decline, cancel) · toasts for success/failure · helpful empty states · accessible dialogs (focus trap, `Esc`, labelled) · full keyboard nav · reduced-motion support. No fake progress bars; no artificial delays.

## 6. Accessibility baseline
Semantic landmarks; labelled form controls; visible focus ring (`--focus`); AA contrast; `aria-live` for toasts and result updates; dialogs with `role="dialog"`/`aria-modal`; hit targets ≥44px on mobile. *Full WCAG conformance requires manual assistive-technology testing and expert review and is not claimed.*

---

## Post-MVP visual identity (current)

The palette evolved from the original green/accent system to a cohesive, warm **Sage & Clay** identity (chosen after direct design iteration). The guiding principle: **one deep, calm, dominant color for structure + one restrained warm spark for actions** — the arrangement that reads premium rather than corporate.

### Current tokens (source of truth: `src/app/globals.css`)
| Token | Value | Role |
|---|---|---|
| `--color-canvas` | `#f4efe3` | warm linen cream (body) |
| `--color-surface` | `#fcf8ef` | ivory card |
| `--color-ink` | `#232a20` | deep olive-charcoal text |
| `--color-brand` | `#5c6f4b` | muted sage-green (structure/links/positive) |
| `--color-brand-deep` | `#2f3b2a` | deep forest-olive (nav, map vignette) |
| `--color-brand-weak` | `#e7ecda` | soft sage tint (active nav, positive surfaces) |
| `--color-accent` | `#c06a4e`→ **`#b14a6b`** | **berry rose** — the single warm spark, primary actions only |
| `--color-amber` | honey | small positive/time accents, in-family |

Key lesson captured: a warm accent next to green reads "green + orange" unless the accent is a true pink-red (berry), not a terracotta/clay. Berry rose is the accent.

### Typography
Editorial **Fraunces** (display headings, via `next/font`) paired with **Inter** (sans body). `.font-display` utility applies optical sizing + tight tracking.

### New components & motifs
- **Map-first hero** (`MapHero`) — immersive UW map with a directional sage vignette (concentrated behind the text, clear on the right so the map shows) and a frosted-glass composer overlaid; submitting routes to `/fix` and auto-runs.
- **Branded map markers** — sage (resource), honey (assistance), berry (needs help); privacy-jittered pins; warm tile filter so the map joins the palette.
- **Avatar** — deterministic initials avatar in the sage/clay family, seeded by user id.
- **UserLink** — name (+ optional avatar) linking to the public profile; used wherever a member appears.
- **Leaderboard** — top contributors with medals/avatars, linking to profiles.
- **Celebration** — reduced-motion-safe confetti + "+N PATCH Points" moment on resolution/completion.
- **Notification bell**, **messages two-pane** (list + thread, responsive collapse), **points page**, **profile page**.

### Motion
120–360ms, purposeful: card hover lift, hero float/stitch, confetti, skeletons, optimistic message send. All gated by `prefers-reduced-motion` (confetti is skipped entirely under reduced motion).
