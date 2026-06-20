# Implementation guide v2 — phases + how to drive Claude Code
## Booking Capture & Follow-up · SvelteKit · Cloudflare · BetterAuth · Drizzle · Gemini

Supersedes the original implementation-phases.md. This version folds in the **design system**
and the **Leads page**, and adds the seams for the two planned features. Build in order, verify
each phase before the next.

### Docs to keep in the repo (`/docs`)
- `claude-code-brief-final.md` — full app spec (schemas, screens).
- `design-system.md` — tokens, type scale, colour, motion, a11y. **Authoritative for all UI.**
- `leads-page.md` — the Leads page spec (venue accordions + table).
- `gemini-extraction-prompt.md` — the extraction prompt + rationale.
- `implementation-phases-v2.md` — this file.

### Golden rules for working with Claude Code
1. Share the relevant doc(s) at the start of each phase. Don't say "build the whole app."
2. Verify each phase (run it, click it) before moving on. Unverified phases compound bugs.
3. Drop the `starter-files` in first so Claude Code builds on correct config.
4. Paste the Gemini prompt **verbatim** — never let it paraphrase.
5. Secrets stay in `.dev.vars` / `wrangler secret` — never committed.
6. Any UI work must follow `design-system.md`. Tokens only, no hardcoded hex/px.

---

## Phase 0 — Accounts & keys (you, ~15 min)
- [ ] Cloudflare account; `npm i -g wrangler` && `wrangler login`.
- [ ] Gemini API key at aistudio.google.com (separate from the Jio/consumer Gemini).
- [ ] Node 20+.

---

## Phase 1 — Scaffold + design-system foundation
**Model/effort:** Opus · High
**Share:** `design-system.md` (+ brief §10).

> "Scaffold SvelteKit + TypeScript + Tailwind v4 + `@sveltejs/adapter-cloudflare`.
> Implement the **entire** `@theme` token block from `design-system.md` in `src/app.css` —
> fonts (Inter + JetBrains Mono), the Major-Third type scale, 8-point spacing, colour tokens,
> shadows, easings — plus the full `.dark` override block. Load fonts in `app.html`. Set up
> dark mode (read OS preference on SSR to avoid flash; class on `<html>`). Build the app shell:
> root `+layout.svelte` with the safe-area-aware sticky bottom tab bar (Upload, Leads, Calls)
> and empty placeholder routes. No features yet — just tokens, theming, and the shell."

**Verify:** three tabs switch; dark mode toggles with no flash; a sample heading/body/pill use
token values (inspect computed CSS vars); it looks premium, not default-Tailwind.

---

## Phase 2 — Cloudflare wiring + database
**Model/effort:** Opus · High
**Share:** starter files `wrangler.toml`, `drizzle.config.ts`, `app.d.ts`, `db/schema.ts`, `db/index.ts`.

**You run:**
```bash
wrangler d1 create leads-db          # paste database_id into wrangler.toml
wrangler r2 bucket create leads-diary-photos
npx drizzle-kit generate
wrangler d1 migrations apply leads-db --local
```
> "Use these files for Cloudflare + Drizzle. The `bookings.status` column keeps all **7**
> states: new | no_answer | interested | quoted | booked | not_interested | callback. Add a
> temporary `/api/health` route (trivial D1 read + R2 list), then run
> `npm run build && wrangler pages dev`. Once green, seed 2–3 vendors."

**Verify:** `/api/health` returns OK under `wrangler pages dev` (not plain `npm run dev`).

---

## Phase 3 — Auth (BetterAuth)
**Model/effort:** Opus · Max / xhigh (gotcha-dense)
**Share:** `auth.ts`, `auth-client.ts`, `hooks.server.ts`, `api/auth/[...all]/+server.ts`.

**You run:** `wrangler secret put BETTER_AUTH_SECRET` (and put it in `.dev.vars` for local).
> "Wire BetterAuth with these files. Build `/login` (email+password → `/leads` on success) and
> the one-time guarded `/setup` (only when zero users exist → creates owner → `/login`). Add a
> sign-out control to the layout. The redirect guard in `hooks.server.ts` protects every route
> except `/login` and `/setup`. Style both screens per `design-system.md`."

**Verify:** setup → login → land on app; logout works; protected route redirects when logged out.

---

## Phase 4 — Extraction pipeline
**Model/effort:** Opus · Max / xhigh (most complex)
**Share:** `gemini.ts` (prompt verbatim), `api/extract/+server.ts`, `gemini-extraction-prompt.md`.

> "Use these files. Build `/upload`: full-bleed camera/gallery zone
> (`accept='image/*' capture='environment'`), vendor dropdown (from `vendors`, inline
> 'add vendor'), submit POSTs FormData to `/api/extract`, 'Reading the diary page…' loading
> state, on success navigate to `/confirm?session=<id>`, errors offer retry. Follow the design
> system."

**Verify:** a real photo extracts; image lands in R2; unconfirmed rows appear in D1 with a
shared `session_id`; confidence scores look sane.

---

## Phase 5 — Confirm screen (the safety net)
**Model/effort:** Opus · High
**Share:** `design-system.md` (confirm screen notes), `leads-page.md` is not needed yet.

> "Build `/confirm`. Load reads `bookings` where `is_confirmed = 0` and `session_id` matches the
> `?session=` param. Show the source photo (stream via `/api/photos/[key]` from R2). Render each
> booking as an editable card; flag any field with stored confidence < 0.75 with the amber
> 'double-check' chip — phones especially. Allow deleting a card. 'Save N bookings' sets
> `is_confirmed = 1` and navigates to `/leads`. Never auto-save."

**Verify:** low-confidence fields flagged; edit + save works; photo shows; deleted cards not saved.

---

## Phase 6 — Leads page (the CRM core)
**Model/effort:** Opus · Max / xhigh (largest, most stateful UI)
**Share:** `leads-page.md` + `design-system.md`.

Build it in the sub-order from `leads-page.md` §11:
> "Build the Leads page strictly per `docs/leads-page.md` and `docs/design-system.md`:
> 1. Venue accordions (closed by default), header anatomy (toggle `<button>` + sibling Import,
>    no nested buttons), chevron transform, grid-rows expand + opacity fade.
> 2. The 8-column leads `<table>` (Select, Name, Date&Time, Event type, Phone, Status, Notes,
>    Send) with row-height clamps (72/88px) and a fixed `w-[120px]` status column. Mock data.
> 3. Responsive: keep it one table — below `md`, horizontal scroll with Select+Name frozen
>    (sticky-left) and the edge-shadow affordance.
> 4. The 7-state status pill dropdown; render the menu in a **portal/fixed layer** (not clipped
>    by the accordion's overflow or the table's overflow-x); full keyboard + a11y; emit
>    `onStatusChange(leadId, status)` with **no** side-effects.
> 5. The Send-showcase control: a Send button per row opening a portal menu of the 4 plans
>    (2×2: Track/Live × Show/with-Entry); emit `onSendShowcase(leadId, plan)`; delivery stubbed.
> 6. Selection checkboxes → a `selected` set (no bulk toolbar yet).
> Use a single `leadsByVenue` store and keyed `{#each ... (lead.id)}` everywhere."

**Verify:** accordions open/close smoothly; table matches the spec on desktop; on a phone the
table scrolls horizontally with Name pinned; status + send menus open in a portal and aren't
clipped; keyboard nav works; dark mode + 200% zoom hold up.

> **Note:** sorting/reordering by status, row removal on `not_interested`, and status-triggered
> overlays are **planned — not built here** (see Phase 8 seams). Build the dispatch points only.

---

## Phase 7 — Call list (today's worklist)
**Model/effort:** Sonnet · High (simpler than Leads)
**Share:** `design-system.md` (call list notes).

> "Status-priority sorting on the Leads page (no separate calls page) where status ∈ {new, no_answer, callback with next_followup_on ≤
> today}, sorted by event_date asc. Each item: name, event type, date, vendor, two large
> tap-targets (Call = accent, WhatsApp = green, 52px), and a one-tap status row that saves
> instantly (optimistic). 'Callback' reveals a date picker. Design-system tokens throughout."

**Verify:** one-tap status logging works; items leave the list correctly; big tap targets on phone.

---

## Phase 8 — Planned-feature seams (architect, don't fully build)
**Model/effort:** Opus · High
**Share:** `leads-page.md` §8, `design-system.md` (modal/overlay tokens).

> "Lay clean seams without building the full features:
> 1. **Overlay host:** mount one store-driven `<OverlayHost>` at the app root (idle). The
>    Leads status handler calls `overlay.open(type, leadId)` for specific transitions later;
>    leave it stubbed. Elevation 4, frosted scrim, focus-trap, reduced-motion aware.
> 2. **Per-venue import:** wire each venue's Import button (and the page-level 'Import photo')
>    to route into the existing `/upload`→`/api/extract`→`/confirm` pipeline with the vendor
>    pre-selected; on confirm, inject rows via `leadsByVenue.addLeads(venueId, rows)` (mutating
>    only that venue's array). New rows fade in with an `isNew` highlight; no scroll-jump.
> 3. **Drag-drop dropzone:** a full-page overlay on `dragenter` that routes dropped images into
>    the same extract→confirm flow. Never inject unconfirmed rows."

**Verify:** importing for a venue adds rows under that venue only; other venues and open/scroll
state are undisturbed; the overlay host exists but stays idle.

---

## Phase 9 — Polish + deploy
**Model/effort:** Sonnet · Medium
**Share:** `design-system.md` (empty states, motion, a11y).

> "Polish: real empty states per tab/venue, skeleton shimmer loaders, a 'Saved!' toast on
> confirm and status change, 150ms transitions on interactive states, full dark-mode audit,
> 200%-zoom + reduced-motion + keyboard pass. Then prepare deploy."

**You deploy:**
```bash
npm run build
wrangler pages deploy .svelte-kit/cloudflare
wrangler d1 migrations apply booking-db --remote
wrangler secret put GEMINI_API_KEY
wrangler secret put BETTER_AUTH_SECRET
```
Then add the live `*.pages.dev` URL to `trustedOrigins` in `src/lib/auth.ts` and redeploy.

**Verify on a real phone:** login → upload → confirm → leads → call, end to end.

---

## What to share — quick reference

| Phase | Model · Effort | Share |
|---|---|---|
| 1 Scaffold + design system | Opus · High | `design-system.md` |
| 2 Cloudflare + DB | Opus · High | starter config + `db/*` |
| 3 Auth | Opus · Max | `auth*`, `hooks.server.ts`, auth route |
| 4 Extraction | Opus · Max | `gemini.ts`, extract route, prompt |
| 5 Confirm | Opus · High | `design-system.md` |
| 6 Leads page | Opus · Max | `leads-page.md` + `design-system.md` |
| 7 Call list | Sonnet · High | `design-system.md` |
| 8 Planned seams | Opus · High | `leads-page.md` §8 |
| 9 Polish + deploy | Sonnet · Medium | `design-system.md` |

Mid-session, prefix a one-off hard problem with `ultrathink` instead of switching settings.

---

## Common failure points
- `Buffer is not defined` → `nodejs_compat` flag missing from `wrangler.toml`.
- D1/R2 undefined → ran `npm run dev` instead of `wrangler pages dev`.
- Auth silently fails after deploy → live URL not in `trustedOrigins`.
- Gemini returns prose, not JSON → `responseMimeType` unset or prompt paraphrased.
- Status menu / send menu cut off → not rendered in a portal; it's being clipped by the
  accordion's `overflow: hidden` or the mobile table's `overflow-x`.
- Imported rows collapse open accordions or jump scroll → `{#each}` not keyed by `lead.id`,
  or the whole store object was replaced instead of mutating one venue's array.