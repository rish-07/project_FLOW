# Leads Page — design-system-aligned spec (v2)
## SvelteKit + Tailwind v4 · read alongside `design-system.md`

Build spec for the Leads page, reconciled with `design-system.md`. If the two ever
disagree, `design-system.md` wins on tokens and accessibility.

**v2 changes:** status taxonomy uses the original **7 states**; the Actions column is a
**"Send showcase"** feature (4 plans); the mobile table stays a real table with a **frozen
Name column** (horizontal scroll) rather than transforming into cards.

---

## 0. Decisions applied

1. **7-state status taxonomy** (matches the app data model and the design-system tokens).
   Default for every new/imported lead is `new`. See §5.
2. **Responsive table = one table.** Identical markup/columns at every breakpoint. On `md+`
   it lays out normally; below `md` it scrolls horizontally with the Select+Name columns
   frozen (sticky-left). See §4.
3. **Accordion expand** uses `grid-template-rows: 0fr → 1fr` + opacity fade (not height
   animation), 200ms `ease-standard`. Chevron rotates via `transform`.
4. **No nested buttons.** Venue toggle is its own `<button>`; Import/count are siblings.
5. **Actions column = Send showcase** (share past-event media to a client). See §6.

---

## 1. Page shell

- **Single centered column**, vertical stacking only, every breakpoint.
- Page bg `bg-base`. Content container:
  ```css
  .leads-container {
    width: 100%;
    max-width: 1120px;
    margin-inline: auto;
    padding-inline: clamp(1rem, 4vw, 2rem);
    padding-block: var(--spacing-3);   /* 24px */
  }
  ```
- 8-point grid throughout: section gaps `var(--spacing-3)` (24px); card padding `var(--spacing-2/3)`.
- Page header: title `text-2xl` "Leads" + a global "Import photo" action (see §8).

```
┌───────────────────────────────────────────────┐  bg-base
│  Leads                          [Import photo] │
│  ┌─────────────────────────────────────────┐  │
│  │ ▸  BMR Convention Hall      12  [Import] │  │  closed accordion
│  └─────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────┐  │
│  │ ▾  VMR Gardens   8 · 3 follow-ups [Import]│ │  open accordion
│  │ ┌─────────────────────────────────────┐ │  │
│  │ │  leads table                        │ │  │
│  │ └─────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

---

## 2. Tier 1 — Venue accordion

### Header anatomy (flex row, not one button)
```
[ toggle <button>: chevron + venue name + count ]   [ Import <button> ]
└─ flex-1, the large target ─────────────────────┘   └─ sibling, stopPropagation
```
- Card: `bg-elevated`, `border var(--color-border-base)`, `radius var(--radius-lg)`,
  `shadow-xs`. Header min-height **64px**.
- Toggle `<button>`: `aria-expanded`, `aria-controls="venue-panel-{id}"`. Holds chevron
  (right), venue name (`text-xl`, `font-semibold`, `text-primary`, `tracking-tight`), and a
  count badge (`text-xs`, `bg-bg-sunken`, `text-text-secondary`, `radius-full`, `px-2 h-6`).
  When the venue has follow-ups, append "· N follow-ups" in `--color-status-callback-text`.
  Hover: `bg → var(--color-bg-sunken)`. Focus-visible: accent ring.
- Import `<button>` (ghost, §8): `@click|stopPropagation` so it never toggles.
  `aria-label="Import leads for {venue} from photo"`.

### Chevron + expand
```css
.chevron { transition: transform var(--duration-base) var(--ease-standard); }
[aria-expanded="true"] .chevron { transform: rotate(180deg); }

.venue-panel {
  display: grid; grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-base) var(--ease-standard);
}
.venue-panel > .panel-inner { overflow: hidden; }
.venue-panel[data-open="true"] { grid-template-rows: 1fr; }
.panel-inner { opacity: 0; transition: opacity var(--duration-short) var(--ease-enter); }
.venue-panel[data-open="true"] .panel-inner { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .venue-panel, .panel-inner { transition: none; }
}
```
- All closed by default. Open state lives in the store (§9), keyed by venue id, so it
  survives row inserts from the import pipeline.

---

## 3. Tier 2 — Leads table

One semantic `<table>` inside the open panel, identical at all breakpoints.

### Structure & sizing
- `<thead>` `<th scope="col">` per column: `text-2xs`, `uppercase`, `tracking-wide`,
  `text-text-tertiary`, `bg-bg-sunken`, sticky-top within the panel on vertical scroll.
- Row height: **72px** single-line, **88px** two-line max (never taller — prevents jitter).
- Cell padding `var(--spacing-1)`–`var(--spacing-2)` (8–16px); `p-2`/`p-3` per density.
- Row hover: `bg → var(--color-bg-sunken)`, `transition background var(--duration-short)`.

### Columns (left → right)

| # | Column | Spec |
|---|--------|------|
| 1 | **Select** | `<input type="checkbox">` → selection store. 44×44 tap area via `::after`. `aria-label="Select {name}"`. Header = "select all in venue". (Bulk toolbar is future — §7.) |
| 2 | **Name** | `text-base`, `font-medium`, `text-primary`. `truncate` if long. |
| 3 | **Date & Time** | `font-mono`, `tabular-nums`, `text-sm`. "Mon 23 Nov · 7:00 PM". |
| 4 | **Event type** | `text-sm`, `text-text-secondary`. Plain text ("Wedding", "Sangeet"). |
| 5 | **Phone** | Right-aligned. `font-mono`, `tabular-nums`, `text-sm`. "+91 98765 43210". Cell is a `tel:` link. |
| 6 | **Status** | Interactive 7-state pill dropdown. Fixed `w-[120px]`. See §5. |
| 7 | **Notes** | `text-sm`, `text-text-secondary`, single line `truncate`, `title={notes}` for full text. `max-w-[200px]`. |
| 8 | **Actions** | Far right. "Send showcase" control + plan menu. See §6. |

### Empty state (no leads in venue)
Quiet centered block in the panel: small icon, `text-sm text-text-tertiary`
"No leads yet for this venue.", inline "Import from photo" button. Never a blank panel.

---

## 4. Responsive behaviour — the table stays a table  **[per owner decision]**

Same `<table>`, same columns, every breakpoint. Only CSS changes.

### `md` and up
Normal table layout; all 8 columns visible within the 1120px container.

### Below `md` (phones)
The table becomes horizontally scrollable, with **Select + Name frozen** on the left so the
client's identity is always visible while scrolling through Date → … → Actions.

```css
.leads-table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
.leads-table { min-width: 720px; }   /* forces horizontal scroll on narrow screens */

/* Freeze the identity columns */
@media (max-width: 767px) {
  .col-select, .col-name {
    position: sticky;
    left: 0;
    background: var(--color-bg-elevated);
    z-index: 1;
  }
  .col-name { left: 44px; }            /* sits right of the 44px select column */
  /* subtle edge shadow signals more content to the right */
  .col-name::after {
    content: '';
    position: absolute; top: 0; right: 0; bottom: 0; width: 8px;
    transform: translateX(100%);
    background: linear-gradient(to right, var(--color-border-base), transparent);
    pointer-events: none;
  }
}
```
- Keep the 72/88px row-height clamps on mobile.
- Frozen cells must use the row's hover/zebra background too, or they'll look detached —
  apply the same background token on hover to `.col-select`/`.col-name`.
- Touch scroll has momentum; the edge shadow is the affordance that more columns exist.
- The status dropdown and Send menu still render in a **portal/fixed layer** (§5/§6) so they
  are not clipped by the table's `overflow-x` or the accordion's `overflow: hidden`.

---

## 5. Status pill dropdown — 7 states

### States → design-system tokens (no loose hex)

| Label | Stored value | Background token | Text token |
|---|---|---|---|
| New | `new` | `--color-status-new-bg` | `--color-status-new-text` |
| No answer | `no_answer` | `--color-status-no-answer-bg` | `--color-status-no-answer-text` |
| Interested | `interested` | `--color-status-interested-bg` | `--color-status-interested-text` |
| Quoted | `quoted` | `--color-status-quoted-bg` | `--color-status-quoted-text` |
| Booked | `booked` | `--color-status-booked-bg` | `--color-status-booked-text` |
| Not interested | `not_interested` | `--color-status-not-int-bg` | `--color-status-not-int-text` |
| Callback | `callback` | `--color-status-callback-bg` | `--color-status-callback-text` |

`new` is the default for every new and imported lead.

### Pill (trigger)
- `<button>` styled as a status pill (design-system §5): `h-6`, `px-2.5`, `radius-full`,
  `text-xs font-medium`, tokens from the table, fixed container `w-[120px]`, caret (▾),
  `aria-haspopup="listbox"`, `aria-expanded`. A leading 8px dot in the text colour +
  the always-present text label (never colour-only meaning).

### Menu (popover)
- Elevation 3: `bg-elevated`, `border var(--color-border-strong)`, `shadow-md`, `radius-md`,
  `p-1`. **Rendered in a portal/`fixed` layer** so it is not clipped by the accordion's
  `overflow: hidden` or the mobile table's `overflow-x`.
- Each option: `<button role="option">`, `h-10`, full-width, left-aligned, dot + label.
  Hover `bg-bg-sunken`; current selection shows a check + accent text.
- Keyboard: open on Enter/Space, arrow-nav, Esc closes, focus returns to the pill.
- Selecting updates state optimistically and emits `onStatusChange(leadId, newStatus)` — a
  single dispatch point (§7). The pill itself holds **no** side-effect logic.
- `aria-live="polite"` announces the new status.

---

## 6. Actions column — "Send showcase"

Lets the organiser send **previous events' photos/videos** to a prospective client, under one
of four plans. The 4 plans are a clean 2×2:

| | Show | with Entry |
|---|---|---|
| **Track** | Track Show | Track with Entry |
| **Live** | Live Show | Live with Entry |

### UI
- Column header: "Send".
- Per row: a **Send `<button>`** (ghost icon, e.g. share/paper-plane, 40×40 visible / 44 tap
  area, `text-text-secondary`, hover `text-accent` + `bg-bg-sunken`).
  `aria-label="Send showcase to {name}"`, `aria-haspopup="menu"`.
- Clicking opens a small **menu** (same portal/elevation-3 popover as the status menu) listing
  the four plans as `role="menuitem"` buttons (`h-10`, dot/icon + label, 44px targets).
  - Recommended layout: a 2×2 grid or two grouped rows (Track / Live), each with Show and
    with-Entry, so the structure reads at a glance.
- Selecting a plan emits `onSendShowcase(leadId, plan)` where
  `plan ∈ 'track_show' | 'live_show' | 'track_entry' | 'live_entry'`.
- Mobile: identical control; it lives in the (scrollable) Actions cell of the same table.

### Behaviour — **assumptions, confirm before wiring**
Built so the mechanism is sound and the delivery step is a single, swappable function:
- `onSendShowcase(leadId, plan)` is the only side-effect entry point. Today it can open a
  share/confirin sheet; the actual delivery is pluggable.
- **Assumed delivery:** a WhatsApp message to the client's number containing a link to the
  relevant showcase media set (consistent with the app's existing `wa.me` usage). The `plan`
  selects which media package/link is sent.
- Keep `plan` as a plain string union so adding/renaming plans later needs no structural change.

> **Open questions for the owner (see chat):** how the showcase is delivered (WhatsApp link?
> in-app gallery? email?), what functionally differs between the 4 plans (different media sets,
> links, or pricing tiers?), and what "Entry" means. None of these block the build — the
> control + dispatch are built now; delivery is wired once defined.

---

## 7. Sorting & status-driven behaviour  **(planned — do NOT build the reordering yet)**

Build now: the pill + `onStatusChange` dispatch. Do **not** yet implement reorder/remove/overlay.

Planned per-venue sort priority (when enabled):

| Priority | Status | Behaviour |
|---|---|---|
| 0 (top) | `callback` | Scheduled follow-ups float to the top |
| 1 | `no_answer` | Tried, needs retry |
| 2 | `new` | Not yet contacted (default) |
| 3 | `interested` | Warm — nurture |
| 4 | `quoted` | Awaiting client decision |
| 5 | `booked` | Done — low urgency, sinks down |
| 6 (hidden) | `not_interested` | Removed from the active list (soft-delete, recoverable) |

Implementation note: derive the rendered order from a pure `sortLeads()` selector over the
store, not by mutating array order in place. Animate row reflow with FLIP (`transform` only).

---

## 8. Planned features — placement (unchanged from v1, summarised)

**A. Transactional overlays (budget/payment on status change).** One overlay host at page
root, store-driven (`activeOverlay`), never inside a row (the accordion clips overflow).
Elevation 4, frosted scrim, focus-trapped, reduced-motion aware. The pill emits only
`onStatusChange`; a single page handler branches side-effects (e.g. `booked → payment
overlay`). Store payments later in a separate `lead_payments` table keyed by `lead_id`.

**B. VLM bulk import.** Entry points: a per-venue Import button in each accordion header
(pre-selects that vendor) and a page-level "Import photo" (asks venue first). Both route into
the **existing** `/api/extract → /confirm` pipeline; confirmed rows inject into that venue.
Drag-drop dropzone overlay routes to the same flow. Imports always pass through confirm before
injection.

State for clean ingestion: single `leadsByVenue` store; keyed `{#each ... (lead.id)}`
everywhere; `addLeads(venueId, rows)` mutates only that venue's array; new rows fade in
(`opacity` + `translateY`) with a brief `isNew` highlight; no scroll-jump (optionally show a
"+N new" pill at the top of the open venue).

---

## 9. State model

```ts
type Status =
  | 'new' | 'no_answer' | 'interested' | 'quoted'
  | 'booked' | 'not_interested' | 'callback';

type ShowcasePlan = 'track_show' | 'live_show' | 'track_entry' | 'live_entry';

interface Lead {
  id: string;
  venueId: string;
  name: string;
  eventDate: string;     // YYYY-MM-DD
  eventTime: string;
  eventType: string;
  phone: string;         // +91XXXXXXXXXX
  status: Status;        // default 'new'
  notes: string | null;
  isNew?: boolean;       // transient highlight after import
}

interface LeadsState {
  leadsByVenue: Record<string, Lead[]>;
  openVenues: Record<string, boolean>;   // accordion state — survives data updates
  selected: Set<string>;                 // future bulk actions
  activeOverlay: { type: string; leadId: string } | null;  // future transactional flows
}
```
Selectors (pure): `sortLeads(venueLeads)`, `visibleLeads` (drops `not_interested` once that
ships), `followUpCount(venueLeads)` (counts `callback`).

---

## 10. Accessibility checklist (this page)

- Venue toggle: `<button aria-expanded aria-controls>`; panel `id` + `role="region"`.
- One semantic `<table>` with `<th scope="col">`; frozen mobile columns keep table semantics.
- Status dropdown & Send menu: `aria-haspopup`, roles (`listbox`/`option`, `menu`/`menuitem`),
  full keyboard nav, focus returns to trigger, `aria-live="polite"` on status change.
- Every checkbox / pill / action has an `aria-label` naming the lead.
- All interactive elements ≥44×44 tap area; status text meets 4.5:1 on its pill bg in both
  themes (use the pre-verified tokens — don't tweak).
- Status conveyed by label + dot + colour, never colour alone.
- Focus-visible accent ring on every focusable element.
- Verify at 200% zoom, in dark mode, and with horizontal-scroll on a real phone.

---

## 11. Build order for this page

1. Static venue accordions (closed), header anatomy, toggle a11y, chevron transform,
   grid-rows expand animation. No table yet.
2. Leads `<table>` with all 8 columns, token-correct, fixed-width status column, row-height
   clamps. Wire to mock store data. Verify on desktop.
3. Mobile: same table, horizontal scroll + frozen Select/Name columns, edge shadow. Verify on
   a phone viewport.
4. Status pill dropdown: 7 states→tokens, portal popover (not clipped), keyboard + a11y,
   `onStatusChange` dispatch (no side-effects yet).
5. Send-showcase control: Send button + 4-plan portal menu (2×2), `onSendShowcase` dispatch
   (delivery stubbed pending owner answers).
6. Selection checkboxes → `selected` set (no bulk toolbar yet).
7. Empty states, dark-mode audit, `svelte-check`, 200%-zoom + reduced-motion + mobile-scroll pass.
8. Leave clean seams for planned features: overlay host mounted but idle; per-venue Import
   routes into the existing extract→confirm pipeline; `leadsByVenue` store + keyed each.

---

## 12. Dev rules (recap)

- Tokens only — every colour/size from `@theme` in `app.css`. No hardcoded hex, no ad-hoc px.
- Semantic HTML — `<button>`/`<a>` only for interactions; no `<div onclick>`.
- Dark mode inverts via `.dark` tokens; verify contrast, don't hardcode unthemed colours.
- Keyed `{#each ... (lead.id)}` everywhere for clean diffing.
- Portal/fixed layer for any popover (status, send menu, overlays) — never clipped by the
  accordion's `overflow: hidden` or the mobile table's `overflow-x`.
- Run `svelte-check` continuously.