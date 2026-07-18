# UI Refinements Plan — Floating Nav · Leads Cards · Confirm-per-image

Status: **proposed** · Author: pairing session 2026-07-18
Scope: four mobile-first refinements, built and verified one step at a time.

This is a working plan. Each step lists **what changes**, the **files touched**, and a
**verify** gate that must pass before moving to the next step. Nothing here relaxes the
project's hard rules (confirm-step integrity, tokens-only, `$lib/server` boundary,
`svelte-check` clean).

---

## Decisions locked (from review)

| # | Area | Decision |
|---|------|----------|
| 1 | Confirm cross-check | **Page image per booking card, zoomable.** Each booking already has its own `sourceImageKey`; show *that page* above the card's fields, tap to zoom/pan. No change to the Gemini prompt/schema. |
| 2 | Floating nav | **Minimal frosted pill + elastic spring capsule + scroll-shrink.** Skip the full-column hit layer and the 4-step tap-reselect cascade (over-built for 3 tabs). |
| 3 | Leads layout | **Vertical cards.** Date + AM/PM on top (mono), name below (larger), secondary phone under primary, alternating row shading. Removes the 900px table. |
| 4 | Process | Detailed plan (this doc) → implement step-by-step, verifying each. |

Parked (not in this plan unless you say so): the concurrent-pool vs sequential
extraction toggle from the earlier interrupted message.

---

## Build order & dependencies

```
Step 1  Floating nav        → global: adds fixed pill + bottom clearance (affects every screen)
Step 2  Leads → cards       → fixes the zoom bug (removes 900px table) + restructure + phoneSecondary
Step 3  Confirm per-image   → per-card page image + zoom lightbox
Step 4  Cross-cutting pass  → svelte-check, reduced-motion, 200% zoom, dark mode, safe-area, deploy-ready
```

Rationale for order: the nav change reserves global bottom clearance that the other
screens must respect, so it goes first. Leads is next because it also resolves the
zoom-out bug you reported. Confirm is self-contained and goes last.

---

## Step 1 — Floating navigation bar

**Goal:** replace the in-flow bottom tab bar with a floating frosted pill that is
reachable from anywhere (fixed to the viewport, above the safe area), with an elastic
sliding active indicator and a scroll-down shrink.

**Why this reverses a past choice:** `+layout.svelte` currently keeps the tab bar in
normal flow on purpose ("no fixed overlay, no dead void"). We're deliberately switching
to floating per the Apple HIG tab-bar direction, so we must re-introduce global bottom
clearance that the old approach didn't need.

### New files
- `src/lib/components/nav/FloatingNav.svelte` — the pill: renders the sliding indicator
  capsule + 3 cells. Derives active index from `$page.url.pathname` (URL is source of truth).
- `src/lib/components/nav/NavIndicator.svelte` *(or inline)* — the sprung capsule.

### Mechanics
- **Pill:** `position: fixed`, centered, `max-width` ~ 380px, `left/right` inset,
  `bottom: calc(env(safe-area-inset-bottom) + var(--spacing-1))`. Frosted via
  `backdrop-filter: blur(20px)` over a translucent `--color-bg-elevated`; `--shadow-md`
  (a genuinely floating element earns a shadow per design-system §7). Fully rounded
  (`--radius-full`).
- **Cells:** 3 real `<a>` links (Upload/Leads/Calls), 52px wide, icon + label. Reuse the
  existing Heroicons outline/solid path pairs already in `TabBar.svelte`. Active =
  solid + `--color-accent`; inactive = outline + `--color-text-tertiary`.
  `aria-current="page"` on the active link.
- **Elastic capsule (the signature effect):** two `spring()` stores from `svelte/motion`
  drive the capsule's **left** and **right** edges independently. Leading edge uses a
  snappier/underdamped spring (overshoots), trailing edge a more damped one (lags) — the
  transient gap *is* the stretch. Width clamped to `[0.6×, 2.2×]` resting width. Springs
  carry current value+velocity so rapid taps interrupt smoothly. Capsule fill =
  `--color-accent-subtle`.
- **Scroll-shrink:** track window scroll direction (compare `scrollY` to last, small
  deadzone). Scroll **down** → pill `transform: scale(0.9)` (recede, keeps its slot);
  scroll **up** → restore to 1.0 with a slight `--ease-spring` bounce. Reset to 1.0 on
  route change. `transform-origin: bottom center`.

### Layout / global changes
- `+layout.svelte`: mount `<FloatingNav />` instead of `<TabBar />` inside the app shell.
- Global bottom clearance so no screen hides content behind the pill: add
  `padding-bottom: calc(env(safe-area-inset-bottom) + 4.5rem)` to `main` (≈ gap + pill
  height + breathing room). Replaces the current `padding-bottom: var(--spacing-3)`.
- Adjust the two existing bottom-anchored bars to sit **above** the pill (they currently
  assume the in-flow bar):
  - `confirm/+page.svelte` `.save-bar` (sticky bottom save CTA).
  - `leads/+page.svelte` `.toast` / `.notes-sheet` `bottom:` offsets.
- Keep `TabBar.svelte` in the repo but unmounted (commented reference), or delete after
  the nav is verified — decide at review. The `.tab-bar` primitive in `app.css` can stay
  until then.

### Accessibility & fallbacks (web-design-guidelines pass here)
- `@supports not (backdrop-filter: blur(1px))` → solid `--color-bg-elevated` fill.
- `prefers-reduced-motion`: solid fill, **instant** indicator move (no springs), no
  scroll-shrink. (The global reduced-motion rule zeroes CSS transitions, but JS springs
  need an explicit guard — set spring `hard`/duration 0.)
- 48px min touch height on each cell; labelled links; visible `:focus-visible` ring.
- `viewport-fit=cover` + `env(safe-area-inset-bottom)` already in `app.html`. ✓

### Verify
- [ ] Pill visible and fixed on Upload/Leads/Calls; reachable without scrolling to page end.
- [ ] Active indicator slides + visibly stretches between tabs; rapid taps don't snap.
- [ ] Scroll down shrinks, scroll up restores; resets on navigation.
- [ ] No screen hides content/controls behind the pill (confirm save CTA clears it).
- [ ] Reduced-motion: instant, solid, no shrink. Dark + light both correct.
- [ ] `svelte-check` clean.

---

## Step 2 — Leads: vertical cards (and the zoom-out fix)

**Goal:** replace the horizontally-scrolling 900px table with a vertical card list that
uses vertical space, and in doing so remove the horizontal overflow that causes the
leads page's anomalous zoom-out.

**Root cause of the zoom bug:** `.leads-table { min-width: 900px }` inside an
`overflow-x:auto` wrapper forces a layout wider than the phone viewport. Vertical cards
have no such min-width, so the page fits the viewport and zoom behaves like the others.
(Confirm by testing after the change.)

### Data threading
- `leads/+page.server.ts` `toLead()`: add `phoneSecondary: r.phoneSecondary`.
- `stores/leads.svelte.ts` `Lead` interface: add `phoneSecondary: string | null`.
- (No schema/migration change — the column already exists.)

### Card anatomy (per lead)
```
┌────────────────────────────────────────────┐
│ 23 APR 2025 · PM        [status pill]        │  ← date+slot mono, small; status top-right
│ Damodar Reddy                                │  ← name, larger (text-lg / --font-sans 600)
│ Marriage                                     │  ← event type, secondary
│ +91 98765 43210                       [call] │  ← primary phone (tel: link)
│ +91 90000 11111                              │  ← secondary phone, only if present
│ ─ notes … ─────────────────────────  ✎  ⋯   │  ← notes preview + edit + Send menu
└────────────────────────────────────────────┘
```
- **Alternating shading:** odd cards `--color-bg-elevated`, even cards `--color-bg-sunken`
  (or a subtle tint) — `:nth-child` on the list. Keeps rows distinguishable without borders.
- Preserve everything the table wired: `StatusPill` (+ `handleStatusChange`), inline
  notes sheet, `SendMenu`, `is-new` highlight, `animate:flip` re-sort, `sortLeads`.
- Keep the venue rail exactly as-is (that horizontal strip is fine and not the overflow
  culprit).
- Line-number (`#`) becomes vestigial in a card layout — drop it or keep as a faint corner
  index; decide at review (lean: drop).

### Desktop
- Cards stack on mobile; at `lg+` either keep single-column cards or a 2-up grid inside
  the spread. Lean: single column for parity; revisit if it feels sparse on desktop.

### Verify
- [ ] Leads page no longer scrolls horizontally; pinch-zoom-out matches other pages.
- [ ] Date+slot on top (mono), name prominent, secondary phone shows only when present.
- [ ] Alternating shading reads clearly in light **and** dark.
- [ ] Status change still re-sorts with FLIP; notes edit + Send still work; import highlight intact.
- [ ] `svelte-check` clean.

---

## Step 3 — Confirm: page image above each booking, zoomable

**Goal:** on the confirm screen, put the *relevant diary page* directly above each
booking's fields so digits can be cross-checked without scrolling to a top rail.

**Constraint honored:** Gemini returns no per-booking coordinates, so we show the full
**page** the booking came from (we have `sourceImageKey` per row) — not a cropped region.
The confirm step and low-confidence flagging are untouched.

### Data threading
- `confirm/+page.server.ts` `load`: include `sourceImageKey: r.sourceImageKey` in each
  returned lead object (currently only the deduped `sourceImageKeys[]` is returned).
- `confirm/+page.svelte` `Card` type: add `sourceImageKey: string | null`.

### UI
- Remove (or de-emphasize) the top `.photo-rail`. Instead, each `<li class="card">` gets,
  above `.fields`, a compact image of its own page:
  `<img src={/api/photos/${c.sourceImageKey}} loading="lazy">` in a fixed-aspect frame.
- **Zoom:** tap the image → fullscreen lightbox overlay (a new
  `src/lib/components/ZoomableImage.svelte` or a small inline dialog) with pinch/pan
  (`touch-action: pinch-zoom`, image in an `overflow:auto` pannable container) and a close
  affordance + Esc + scrim-click. Focus-trap the overlay (reuse the OverlayHost pattern).
- If two bookings share a page (common — a page has several entries), each still shows that
  same page; that's expected and fine for cross-checking.

### Verify
- [ ] Each booking card shows its correct source page directly above its fields.
- [ ] Tap opens a zoomable/pannable fullscreen view; Esc/scrim/close all dismiss it.
- [ ] Low-confidence "Double-check" chips still flag fields; save flow unchanged.
- [ ] Reduced-motion respected; dark + light correct.
- [ ] `svelte-check` clean.

---

## Step 4 — Cross-cutting verification pass

- `svelte-check` — 0 errors / 0 warnings across all changes.
- Manual device pass (cf:dev + phone/emulator): reduced-motion, 200% browser zoom,
  keyboard-only nav, dark + light, iOS safe-area (home indicator clearance).
- Confirm no regressions to the four hard invariants: confirm-step integrity, tokens-only
  (no hardcoded hex/px beyond the sanctioned WhatsApp green), `$lib/server` boundary,
  `wa.me`/`tel:` link rules.
- Rebuild note: `cf:dev` has no HMR — kill 8788 + fresh `npm run cf:dev` + hard refresh
  after each step before verifying.

---

## Open questions to resolve at each step's review
1. **Step 1:** keep per-tap glyph "pop" too, or capsule + shrink only? (Plan: capsule +
   shrink only, matching your choice.)
2. **Step 2:** drop the `#` line-number in cards, or keep a faint index? (Plan: drop.)
3. **Step 2:** desktop — single-column cards or 2-up grid? (Plan: single column, revisit.)
4. **Step 3:** fully remove the top photo rail, or keep it collapsed as a "see all pages"
   affordance? (Plan: remove; per-card image supersedes it.)
