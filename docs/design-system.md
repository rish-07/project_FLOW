# Design system
## Booking Capture & Follow-up — SvelteKit + Tailwind v4

This file is the single source of truth for every visual decision in the app.
Claude Code must read and apply this before building or modifying any UI component.

**Direction: "Ledger."** The product's real subject is a handwritten diary turned into a
working list. The visual language comes from that object — ink, a single warm metal
accent, ruled lines instead of shadow-boxes, mono figures for anything counted. Not a
generic dark-mode SaaS skin with a teal accent swapped for gold.

---

## 0. Philosophy

This is a **working tool, not a marketing page.** Your client uses it under pressure —
on her phone, mid-call, in bad lighting. Every design decision optimises for:

1. **Speed of comprehension.** She must read a booking row and act in under two seconds.
2. **Tap confidence.** Buttons and status actions are large, spaced, and forgiving.
3. **Trust through precision.** Numbers, dates, and names look exact and deliberate — not casual.
4. **Premium calm.** The app feels like a well-kept ledger, not a generic dashboard. Dark mode first.

When in doubt, choose the option that is **quieter** — less colour, less shadow, less motion.
Restraint is the premium signal. Noise is the cheap signal. Spend boldness in exactly one
place per screen (the Brass accent, a single focal point); everything else stays disciplined.

---

## 1. Tailwind v4 setup

Tailwind v4 has no `tailwind.config.ts`. Every token lives in the `@theme` block in
`src/app.css`. This is the **only place** design tokens are defined. Do not hardcode
hex values or pixel sizes anywhere else in the codebase — always use the tokens below.

```css
/* src/app.css */
@import "tailwindcss";

@theme {

  /* ── Fonts ──────────────────────────────────────────────────────────── */
  /* Display: Fraunces — soft-serif, variable optical-size axis. Used with
     restraint at heading sizes only; never for body or UI labels. */
  --font-display: "Fraunces Variable", "Fraunces", Georgia, serif;
  --font-sans:    "Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono:    "JetBrains Mono", "Fira Code", ui-monospace, monospace;

  /* ── Type scale (base 16px) ───────────────────────────────────────────── */
  --text-2xs:   0.625rem;   /* 10px  — overlines, ledger line-numbers       */
  --text-xs:    0.75rem;    /* 12px  — captions, helper text                */
  --text-sm:    0.875rem;   /* 14px  — secondary body                      */
  --text-base:  1rem;       /* 16px  — primary body                        */
  --text-lg:    1.25rem;    /* 20px  — large body / sub-heading            */
  --text-xl:    1.5rem;     /* 24px  — H4 (Fraunces)                       */
  --text-2xl:   1.875rem;   /* 30px  — H3 (Fraunces)                       */
  --text-3xl:   2.375rem;   /* 38px  — H2 (Fraunces)                       */
  --text-4xl:   3rem;       /* 48px  — H1 / screen titles (Fraunces)       */

  /* ── Line heights ───────────────────────────────────────────────────── */
  --leading-none:    1;
  --leading-tight:   1.15;  /* Fraunces headings — tighter than a grotesque needs */
  --leading-snug:    1.3;   /* sub-headings                                       */
  --leading-normal:  1.5;   /* body text                                          */
  --leading-relaxed: 1.65;  /* long-form reading                                  */

  /* ── Letter spacing ─────────────────────────────────────────────────── */
  /* Fraunces is organic, not geometric — it needs LESS tightening than Inter
     did at the same sizes. Over-tightening a serif kills its warmth. */
  --tracking-tighter: -0.015em; /* H1, H2 (Fraunces)              */
  --tracking-tight:   -0.01em;  /* H3, H4 (Fraunces)              */
  --tracking-normal:   0em;     /* body (Inter)                   */
  --tracking-wide:     0.04em;  /* labels, badges, caps (Inter)   */
  --tracking-wider:    0.08em;  /* overlines (Inter)              */

  /* ── Spacing (8-point grid — the unit, not the answer; see §4) ───────── */
  --spacing-0:   0;
  --spacing-0h:  0.25rem;   /*  4px — hairline gaps             */
  --spacing-1:   0.5rem;    /*  8px                             */
  --spacing-2:   1rem;      /* 16px                             */
  --spacing-3:   1.5rem;    /* 24px                             */
  --spacing-4:   2rem;      /* 32px                             */
  --spacing-6:   3rem;      /* 48px                             */
  --spacing-8:   4rem;      /* 64px                             */
  --spacing-10:  5rem;      /* 80px                             */
  --spacing-12:  6rem;      /* 96px                             */
  --spacing-16:  8rem;      /* 128px                            */

  /* ── Border radius ─────────────────────────────────────────────────────
     A ledger is cut paper and straight rules, not rounded plastic. Tighter
     than a typical consumer-app scale on purpose. */
  --radius-sm:   0.25rem;   /*  4px — tags, badges, dots         */
  --radius-md:   0.375rem;  /*  6px — inputs, buttons            */
  --radius-lg:   0.5rem;    /*  8px — panels, the open spread    */
  --radius-xl:   0.75rem;   /* 12px — sheets, modals             */
  --radius-full: 9999px;    /* pills, dots                       */

  /* ── Breakpoints ────────────────────────────────────────────────────── */
  --breakpoint-sm:  480px;   /* large phone landscape            */
  --breakpoint-md:  768px;   /* tablet                           */
  --breakpoint-lg:  1024px;  /* desktop — asymmetric splits engage */
  --breakpoint-xl:  1280px;  /* wide desktop                     */

  /* ── Component metrics ──────────────────────────────────────────────── */
  --tab-bar-height: 4rem;    /* 64px — bottom tab bar (excl. safe area) */
  --rail-width:     15rem;   /* 240px — leads venue-tab rail, desktop   */

  /* ── Colours — "Parchment" (light) mode ───────────────────────────────
     Default tokens below are the light variant. `.dark` overrides them
     with the "Ink" variant, which is the primary, dark-first experience. */

  /* Surfaces (60%) */
  --color-bg-base:        #F2ECDD;  /* Parchment — warm paper            */
  --color-bg-elevated:    #F9F5EA;  /* lighter paper — cards, inputs     */
  --color-bg-sunken:      #E7DFC8;  /* deeper paper — inset sections     */
  --color-bg-overlay:     rgba(27, 24, 18, 0.5);

  /* Structure & text (30%) */
  --color-text-primary:   #1B1812;  /* Ink — not pure black              */
  --color-text-secondary: #6B6152;
  --color-text-tertiary:  #8A7D67;
  --color-text-inverse:   #F2ECDD;
  --color-border-base:    rgba(27, 24, 18, 0.10);  /* hairline — see §1B */
  --color-border-strong:  rgba(27, 24, 18, 0.20);
  --color-border-focus:   #8C6A1F;  /* darkened Brass for light-mode contrast */

  /* Accent — Brass (10%). One accent, used only for: primary action, the
     active nav rule, focus rings, links, the open ledger spread's rule. */
  --color-accent:         #C89B3C;  /* Brass — fill colour (buttons, dots)   */
  --color-accent-strong:  #8C6A1F;  /* darkened Brass — accent TEXT in light mode, needs the contrast */
  --color-accent-subtle:  #EFE0BB;  /* chip / highlight bg                    */
  --color-accent-text:    #5C4513;  /* text on accent-subtle                  */

  /* Status — "temperature" mapping, not arbitrary categories (see §3).
     Cold (untouched) → warm (engaged) → resolved (won/lost). Four hues total. */
  --color-temp-cold-bg:      #E7DFC8;
  --color-temp-cold-text:    #6B6152;
  --color-temp-warming-bg:   #F1DDB0;
  --color-temp-warming-text: #7A5A12;
  --color-temp-warm-bg:      #EFE0BB;
  --color-temp-warm-text:    #5C4513;
  --color-temp-won-bg:       #DCE6D5;
  --color-temp-won-text:     #3D5234;
  --color-temp-lost-bg:      #F1DAD4;
  --color-temp-lost-text:    #7A2F22;

  /* Semantic feedback (Brick / Sage / Ochre — same hues as the temperature
     map, used here for system messages rather than lead status). */
  --color-warning-bg:    #F1DDB0;
  --color-warning-text:  #7A5A12;
  --color-warning-icon:  #9C7019;
  --color-danger-bg:     #F1DAD4;
  --color-danger-text:   #7A2F22;
  --color-success-bg:    #DCE6D5;
  --color-success-text:  #3D5234;

  /* ── Shadows ──────────────────────────────────────────────────────────
     A ledger is flat. Shadows are nearly absent — depth comes from rule
     lines and surface-tone shifts (§7), not elevation. Reserve shadow for
     things that truly float above the page: menus, modals, toasts. */
  --shadow-xs:  0 1px 2px rgba(27, 24, 18, 0.04);
  --shadow-sm:  0 2px 4px rgba(27, 24, 18, 0.06);
  --shadow-md:  0 6px 16px rgba(27, 24, 18, 0.10);
  --shadow-lg:  0 16px 32px rgba(27, 24, 18, 0.14);
  --shadow-inset: inset 0 1px 2px rgba(27, 24, 18, 0.05);

  /* ── Transitions ──────────────────────────────────────────────────────
     ease-standard / enter / exit drive structural changes (layout, open/
     close). ease-premium is reserved for hover/focus on interactive
     surfaces — a slower-starting, confident settle, distinct from the
     snappier ease-standard so a hover doesn't feel like a state machine. */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-enter:    cubic-bezier(0.0, 0.0, 0.2, 1);
  --ease-exit:     cubic-bezier(0.4, 0.0, 1, 1);
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-premium:  cubic-bezier(0.22, 1, 0.36, 1);   /* hover/focus signature curve */

  --duration-fast:   100ms;
  --duration-short:  150ms;
  --duration-base:   200ms;
  --duration-medium: 300ms;
  --duration-long:   400ms;

}

/* ── Dark mode token overrides — "Ink", the primary experience ─────────── */
/* Applied via class="dark" on <html>. app.html reads the OS preference and
   sets this pre-paint to avoid a flash. */
.dark {
  --color-bg-base:        #15130F;  /* Ink                               */
  --color-bg-elevated:    #211D15;  /* Ledger — panels, the open spread  */
  --color-bg-sunken:      #0F0D0A;  /* deeper than Ink — inset sections  */
  --color-bg-overlay:     rgba(0, 0, 0, 0.65);

  --color-text-primary:   #F2ECDD;  /* Parchment                          */
  --color-text-secondary: #B4A98F;
  --color-text-tertiary:  #8C8068;
  --color-text-inverse:   #1B1812;
  --color-border-base:    rgba(242, 236, 221, 0.08);  /* hairline — §1B */
  --color-border-strong:  rgba(242, 236, 221, 0.16);
  --color-border-focus:   #C89B3C;  /* full-brightness Brass reads on dark */

  --color-accent:         #C89B3C;  /* Brass                              */
  --color-accent-strong:  #DCB75E;  /* lighter Brass — accent text on dark */
  --color-accent-subtle:  rgba(200, 155, 60, 0.14);
  --color-accent-text:    #E8CE8C;

  --color-temp-cold-bg:      rgba(140, 128, 104, 0.16);
  --color-temp-cold-text:    #B4A98F;
  --color-temp-warming-bg:   rgba(184, 134, 43, 0.16);
  --color-temp-warming-text: #E0B563;
  --color-temp-warm-bg:      rgba(200, 155, 60, 0.16);
  --color-temp-warm-text:    #E8CE8C;
  --color-temp-won-bg:       rgba(124, 144, 112, 0.16);
  --color-temp-won-text:     #A8C29A;
  --color-temp-lost-bg:      rgba(168, 72, 59, 0.16);
  --color-temp-lost-text:    #E0897A;

  --color-warning-bg:    rgba(184, 134, 43, 0.16);
  --color-warning-text:  #E0B563;
  --color-warning-icon:  #D9A53E;
  --color-danger-bg:     rgba(168, 72, 59, 0.16);
  --color-danger-text:   #E0897A;
  --color-success-bg:    rgba(124, 144, 112, 0.16);
  --color-success-text:  #A8C29A;

  --shadow-xs:  0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-sm:  0 2px 4px rgba(0, 0, 0, 0.35);
  --shadow-md:  0 6px 16px rgba(0, 0, 0, 0.4);
  --shadow-lg:  0 16px 32px rgba(0, 0, 0, 0.5);
}
```

### §1B — The border doctrine: low-opacity, never harsh

Every border in this app is an `rgba`/opacity value against the current surface, never
a flat opaque grey. `--color-border-base` (8–10% opacity) is the default for hairline
rules — table row separators, panel edges, input borders at rest. `--color-border-strong`
(16–20%) is for things that need to read as a distinct control at rest: input fields,
dropdown menus, the venue-tab rail's closed tabs. Never reach for a third, darker
opaque grey "just to make it visible" — if a hairline border disappears against its
surface, the fix is raising its opacity by one step, not abandoning the rgba approach
for a flat colour. A flat grey border is the single fastest way to make a panel look
like a Bootstrap default.

---

## 2. Typography

### Font loading (src/app.html)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Three voices, each with one job

| Voice | Face | Used for | Never for |
|---|---|---|---|
| **Display** | Fraunces, 600–680 | Screen titles, venue names in the rail/spread, large counts | Body copy, button labels, table cells |
| **Body** | Inter, 400–500 | Everything else — labels, inputs, descriptions, button text | Headings above `text-lg` |
| **Data** | JetBrains Mono, tabular-nums | Phone numbers, dates, ledger row numbers, counts-in-context | Prose of any kind |

Mixing Fraunces into a button or a table cell to "look fancy" is the failure mode to
avoid — restraint is what makes the display face land as a choice instead of a flourish.

### Type scale reference

| Token     | Size  | Face     | Weight | Leading      | Tracking    | Usage                          |
|-----------|-------|----------|--------|--------------|-------------|---------------------------------|
| `text-4xl`| 48px  | Fraunces | 680    | tight (1.15) | tighter     | Screen titles (rare)          |
| `text-3xl`| 38px  | Fraunces | 660    | tight (1.15) | tighter     | H2, venue name in open spread |
| `text-2xl`| 30px  | Fraunces | 640    | snug (1.3)   | tight       | H3, section titles            |
| `text-xl` | 24px  | Fraunces | 600    | snug (1.3)   | tight       | H4, card headings             |
| `text-lg` | 20px  | Inter    | 500    | normal (1.5) | normal      | Sub-headings, large labels    |
| `text-base`| 16px | Inter    | 400    | normal (1.5) | normal      | Primary body, table cells     |
| `text-sm` | 14px  | Inter    | 400    | normal (1.5) | normal      | Secondary body, descriptions  |
| `text-xs` | 12px  | Inter    | 500    | normal (1.5) | wide        | Labels, chips, captions       |
| `text-2xs`| 10px  | Mono     | 500    | none (1.0)   | wider       | Overlines, ledger line-numbers|

**The rule: tracking tightens as size grows, loosens as size shrinks** — but Fraunces
needs roughly half the tightening Inter did at the same size, because it's organic, not
geometric. Never use `tracking-normal` above `text-xl` or below `text-sm`.

**Dark mode weight bump:** In `.dark`, increment body weight by one step (400 → 450,
e.g. `font-[450]` with Inter Variable) to counteract halation on dark backgrounds.

### Fluid type — every Fraunces heading scales with viewport

```css
.text-display { font-size: clamp(1.875rem, 1.35rem + 2.6vw, 3rem);     letter-spacing: -0.015em; font-family: var(--font-display); }  /* text-4xl */
.text-h2       { font-size: clamp(1.625rem, 1.25rem + 1.9vw, 2.375rem); letter-spacing: -0.015em; font-family: var(--font-display); }  /* text-3xl */
.text-h3       { font-size: clamp(1.375rem, 1.15rem + 1.1vw, 1.875rem); letter-spacing: -0.01em;  font-family: var(--font-display); }  /* text-2xl */
.text-h4       { font-size: clamp(1.125rem, 1.0rem  + 0.6vw, 1.5rem);   letter-spacing: -0.01em;  font-family: var(--font-display); }  /* text-xl  */
```

Below `text-h4`, do not use `clamp()` or `var(--font-display)` — body, label, and
caption sizes stay fixed Inter. Fluid scaling and the display face both exist to protect
*headings* at the extremes; neither has a job at reading sizes.

### Phone numbers, dates, and ledger row numbers

Always `font-mono` with `tabular-nums`. Non-negotiable — it signals precision and is
now also a structural callback to the ledger metaphor (every counted thing gets a
ledger-style figure):

```html
<span class="font-mono text-sm tabular-nums tracking-normal">+91 98765 43210</span>
```

---

## 3. Colour system

### The 60-30-10 rule (enforced)

- **60% — Surfaces:** `bg-base` (Ink/Parchment), `bg-elevated` (Ledger/lighter-paper),
  `bg-sunken`. Neutral, warm-toned, never the loudest thing on screen.
- **30% — Structure:** Text, hairline borders, icons. Creates hierarchy without colour.
- **10% — Accent (Brass):** Primary CTA, the active-tab rule, focus rings, links, the
  open ledger spread's top rule. If something is Brass and it isn't one of those five
  things, remove it.

### Forbidden

- Pure `#000000` or `#FFFFFF` anywhere in the UI (use token values).
- Introducing new arbitrary colours outside the token system. If a colour isn't in
  `@theme`, it doesn't exist in this app.
- Using Brass for decoration, borders, or hover states on non-primary elements.
- Relying on colour alone to communicate meaning — always pair colour with an icon, dot
  label, or text.
- **Any multi-hue gradient** as a background, card fill, or button fill — purple-to-blue,
  pink-to-orange, or any `linear-gradient()`/`radial-gradient()` spanning more than one
  hue family. The single most recognisable "made by an AI" tell in UI right now, and it
  directly contradicts the calm/restraint philosophy in §0. This app has exactly one
  accent hue. Reach for a border, a rule line, or a surface-tone shift instead.
- Decorative blurred colour blobs / mesh gradients anywhere.
- Saturating Brass above its token value for emphasis — if it needs to "pop" harder,
  the fix is spacing or hierarchy, not saturation.
- A flat opaque grey border (see §1B) — borders are low-opacity rgba against the surface.

### Status: temperature, not category

Lead status is no longer a Notion-style 7-hue tag palette. It's a four-stop temperature
read — how close a lead is to closing — and the colour *is* the information, not a
decoration on top of it:

```
cold (new)              → Faded Ink dot   — untouched
warming (no_answer,      → Ochre dot       — attempted, unresolved
          callback)
warm (interested, quoted)→ Brass dot       — engaged, in progress
won (booked)             → Sage dot        — resolved, positive
lost (not_interested)    → Brick dot       — resolved, negative
```

```svelte
const TEMP_STYLES = {
  new:            'bg-[var(--color-temp-cold-bg)]    text-[var(--color-temp-cold-text)]',
  no_answer:      'bg-[var(--color-temp-warming-bg)] text-[var(--color-temp-warming-text)]',
  callback:       'bg-[var(--color-temp-warming-bg)] text-[var(--color-temp-warming-text)]',
  interested:     'bg-[var(--color-temp-warm-bg)]    text-[var(--color-temp-warm-text)]',
  quoted:         'bg-[var(--color-temp-warm-bg)]    text-[var(--color-temp-warm-text)]',
  booked:         'bg-[var(--color-temp-won-bg)]     text-[var(--color-temp-won-text)]',
  not_interested: 'bg-[var(--color-temp-lost-bg)]    text-[var(--color-temp-lost-text)]',
};
```

Always pair the dot with the status word (`STATUS_LABELS`) — the dot is a fast visual
scan aid, the label is what actually states the status, per the colour-not-only rule.

### Confidence warning (Ochre chip)

Fields extracted with `confidence < 0.75` get an Ochre warning indicator — same shape
as a status dot, reusing the "warming" temperature colour since both mean "needs a
human look before it's trusted":

```svelte
<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
             bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]">
  <svg class="w-3 h-3 text-[var(--color-warning-icon)]" .../>
  Double-check
</span>
```

---

## 4. Spacing & layout grid

### The rule: every dimension snaps to the 8px grid — but the grid is not the design

| Token          | Value | Px   | Use cases                               |
|----------------|-------|------|------------------------------------------|
| `--spacing-0h` | 0.25r | 4px  | Icon-to-label gaps, hairline offsets    |
| `--spacing-1`  | 0.5r  | 8px  | Tight internal padding, inline gaps     |
| `--spacing-2`  | 1r    | 16px | Standard padding, row gaps              |
| `--spacing-3`  | 1.5r  | 24px | Card padding, section gaps              |
| `--spacing-4`  | 2r    | 32px | Between sections                        |
| `--spacing-6`  | 3r    | 48px | Large section separations               |
| `--spacing-8`  | 4r    | 64px | Page-level vertical rhythm              |

8px is the *unit*, not the *answer*. Defaulting every gap to `--spacing-2` everywhere
is what makes an interface read as machine-generated — uniform padding has no opinion
about what matters on the screen. Two rules govern actual spacing decisions:

**1. Relationship distance encodes relationship strength.** Elements that belong
together (a label and its input, an icon and its text, a price and its currency
symbol) sit at `--spacing-0h`–`--spacing-1`. Elements that are merely adjacent but
unrelated sit at `--spacing-4` or wider. Never let a "belongs together" gap and a
"merely adjacent" gap end up visually similar.

**2. Breathing room is asymmetric, not box-model-uniform.** Lead-in space (above a
heading) should be looser than trailing space (below the last line, before a button
row) — content needs more air to *arrive* than to *leave*.

```css
.card-with-action {
  padding-top: var(--spacing-3);     /* 24px — generous lead-in above the heading   */
  padding-inline: var(--spacing-2);  /* 16px — gutter, symmetric is correct here    */
  padding-bottom: var(--spacing-2);  /* 16px — tighter trailing space before edge   */
}
```

The jump from "tightly related" (8px) to "section boundary" (48px+) should be roughly
geometric (8 → 24 → 64), not arithmetic (16 → 32 → 48) — geometric spacing makes
hierarchy legible at a glance, before anyone reads a word.

### Asymmetric page composition (desktop/tablet, ≥1024px)

Below `--breakpoint-lg`, every screen is a single centred column — that's correct for a
phone in one hand. At `--breakpoint-lg` and above, a single centred column just adds
margin on both sides of the same narrow content; it doesn't compose the extra width. Two
canonical asymmetric splits replace it:

- **Page + margin** (Upload): a wide primary zone (~64%) holding the dominant
  focal object, full-bleed, no card border — paired with a narrower margin rail (~36%)
  on the `bg-elevated` tone, holding secondary controls. Proportions are deliberately
  uneven, like an actual page-with-margin, not a 50/50 split.
- **Rail + open spread** (Leads): a narrow rail (`--rail-width`, ~240px) of closed
  "tabs" against `bg-sunken`, paired with a dominant open detail pane (the remaining
  width) on `bg-elevated`, full-bleed, no card border. Exactly one item is "open" at a
  time — the asymmetry encodes which thing currently matters, not just available space.

In both cases, the large zone has **no card chrome** (no border-radius box, no shadow
sitting inside the page) — it reads as the page itself, not content inside a container.

### Mobile layout (primary)

```
Screen width:    375px – 480px
Content gutter:  16px (1rem) each side
Max content:     375 - 32 = 343px
Columns:         4
Column gap:      8px
```

### Tablet layout

```
Screen width:    768px – 1023px
Content gutter:  24px each side
Columns:         8
Column gap:      16px
```

### Desktop layout

```
Screen width:    1024px+
Max container:   1280px centred
Content gutter:  32px each side
Columns:         12
Column gap:      24px
```

### Responsive container

```css
.container-app {
  width: 100%;
  max-width: 1280px;
  margin-left: auto;
  margin-right: auto;
  padding-left: clamp(1rem, 4vw, 2rem);
  padding-right: clamp(1rem, 4vw, 2rem);
}
```

### Bottom tab bar (mobile — safe area aware)

```css
.tab-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  height: calc(64px + env(safe-area-inset-bottom, 0px));
  background: var(--color-bg-elevated);
  border-top: 1px solid var(--color-border-base);
}
```

---

## 5. Component specifications

### The interaction recipe — every component answers these four questions

No interactive element ships without an explicit answer to all four.

| # | Question | Default answer for this app |
|---|----------|------------------------------|
| 1 | What changes on hover? | One property only — bg, border, or text colour, via `var(--ease-premium)`. Never combine two colour changes on hover; save the second for active/focus. |
| 2 | What changes on press/active? | `transform: scale(0.97)` on tappable surfaces, `var(--ease-spring)`, 100ms. Colour is hover's job, motion is press's job. |
| 3 | What's the easing? | `var(--ease-premium)` for hover/focus colour and border changes — a confident, slightly-decelerated settle, distinct from the snappier `var(--ease-standard)` used for structural state changes (open/close, expand/collapse). `var(--ease-spring)` only for scale/transform. Never `linear`, never default `ease`. |
| 4 | What's the duration? | 150–200ms for hover/focus (the premium curve needs slightly longer than the old 100ms to read as deliberate, not instant). 100ms for press. Never above 300ms for a hover/press response. |

### Buttons

```
Primary CTA
  bg: var(--color-accent)
  text: var(--color-text-inverse) — on Brass, Ink text in dark mode, Parchment in light
  height: 48px (min — touch target)
  padding: 0 24px
  radius: var(--radius-md)
  font: 15px / weight 600 / tracking-normal / Inter
  transition: background var(--duration-base) var(--ease-premium),
              transform var(--duration-fast) var(--ease-spring),
              box-shadow var(--duration-base) var(--ease-premium)
  hover: bg lightens one step (mix toward --color-text-inverse 8%), shadow → var(--shadow-sm)
  active: transform scale(0.97) — spring ease, 100ms
  focus-visible: outline 2px var(--color-accent), outline-offset 2px

Secondary
  bg: transparent
  border: 1px solid var(--color-border-strong)   /* low-opacity, never flat grey — §1B */
  text: var(--color-text-primary)
  transition: background var(--duration-base) var(--ease-premium),
              border-color var(--duration-base) var(--ease-premium),
              transform var(--duration-fast) var(--ease-spring)
  hover: bg → var(--color-bg-sunken), border-color → step up one opacity tier
  active: transform scale(0.97)

Destructive
  bg: var(--color-danger-bg)
  text: var(--color-danger-text)
  transition: background var(--duration-base) var(--ease-premium),
              transform var(--duration-fast) var(--ease-spring)
  hover: bg darkens one step toward --color-danger-text — never opacity (opacity dims
         the text along with the bg, hurting contrast right when it matters most)
  active: transform scale(0.97)

Ghost (icon-only)
  bg: transparent
  icon: var(--color-text-secondary)
  size: 40×40px visible, 44×44px hit area minimum (extend with padding, not a smaller
        visible icon in a larger invisible box that silently fails a layout audit)
  transition: background var(--duration-base) var(--ease-premium),
              color var(--duration-base) var(--ease-premium)
  hover: bg → var(--color-bg-sunken), icon colour → var(--color-text-primary)
  active: transform scale(0.94)
```

### Panels — the open spread / page zone (no card chrome)

```
The dominant zone in an asymmetric split (§4) is NOT a card. No border-radius box,
no shadow, no border around its edges — it reads as the page itself.
bg: var(--color-bg-elevated)
The only visible structure: a 1px var(--color-border-base) rule where it meets the
margin/rail, and internal hairline rules (§1B) separating its own content (table rows,
field groups). Depth comes from the bg-base → bg-elevated tone shift across that
boundary, not from shadow.
```

### Cards (secondary content only — not the page's focal zone)

```
bg: var(--color-bg-elevated)
border: 1px solid var(--color-border-base)   /* low-opacity — §1B */
radius: var(--radius-lg)
padding: 20px (desktop) / 16px (mobile)
shadow: var(--shadow-xs)
hover: border-color → var(--color-border-strong), shadow → var(--shadow-sm)
transition: border-color var(--duration-base) var(--ease-premium),
            box-shadow var(--duration-base) var(--ease-premium)

Reserve cards for secondary/ancillary content (e.g. the confirm-screen booking cards,
the calls worklist). The screen's one dominant focal zone is never a card — see above.
```

### Form inputs

```
height: 48px
padding: 0 16px
bg: var(--color-bg-elevated)
border: 1px solid var(--color-border-strong)   /* low-opacity — §1B */
radius: var(--radius-md)
font: text-base / weight 400 / Inter
color: var(--color-text-primary)
placeholder: var(--color-text-tertiary)

focus:
  outline: none
  border-color: var(--color-accent)
  box-shadow: 0 0 0 3px var(--color-accent-subtle)
  transition: border-color var(--duration-base) var(--ease-premium),
              box-shadow var(--duration-base) var(--ease-premium)

error state:
  border-color: var(--color-danger-text)
  box-shadow: 0 0 0 3px var(--color-danger-bg)

Textarea: same as above, height auto, min-height 96px, padding 12px 16px
```

### Status pills (temperature dots — §3)

```
display: inline-flex, align-items: center
height: 24px
padding: 0 10px
radius: var(--radius-full)
font: text-xs / weight 500 / tracking-wide / Inter
includes: an 8px temperature dot (background: currentColor) + the status word — never
the dot alone
colours: see §3 temperature mapping

On status change: transition background/color var(--duration-base) var(--ease-standard)
(a structural change, not a hover — use ease-standard here, not ease-premium), plus a
brief scale 1 → 1.08 → 1 over 250ms var(--ease-spring). This is the one moment a pill is
allowed to move; at rest it never animates.
```

### Venue-tab rail item (Leads — closed tab)

```
display: flex, flex-direction: column, gap: var(--spacing-0h)
min-height: 56px
padding: var(--spacing-2)
bg: transparent at rest, var(--color-bg-elevated) when active (the "open" tab)
border-left: 2px solid transparent at rest, var(--color-accent) when active
  — the rule line is the active signal, matching the tab-bar's brass-rule pattern.
No icon, no chevron. Just the venue name (Inter, text-sm, weight 600) and a mono
count below it (text-xs, var(--color-text-tertiary)), e.g. "12 · 3 due".
transition: background var(--duration-base) var(--ease-premium),
            border-color var(--duration-base) var(--ease-premium)
hover (inactive tabs only): bg → var(--color-bg-sunken)
```

### Bottom tab bar — tab item (brass rule, not just colour)

```
width: 33.33% (3 tabs)
height: 64px (+ safe area)
display: flex, flex-direction: column, align-items: center, justify-content: center
gap: 4px between icon and label

A 2px var(--color-accent) rule sits at the TOP of the active tab's column (full tab
width), inset 12px from each side — not a full-width bar, a deliberate short rule,
like a tab divider in a ledger. This is the primary active signal; icon/label colour
change is secondary reinforcement, not the only one (colour-not-only).

icon: 24px, Heroicons outline set
label: text-xs / weight 500 / Inter

inactive: icon + label colour: var(--color-text-tertiary), no rule
active:   icon + label colour: var(--color-accent), icon: filled variant, rule visible

transition: color var(--duration-base) var(--ease-premium),
            opacity var(--duration-base) var(--ease-premium) (on the rule, not a slide)
```

### Skeleton loaders

```
bg: var(--color-bg-sunken)
radius: same as the element being replaced
animation: shimmer (see §6)
Skeleton widths randomised within a range to feel organic.
```

### Toast notifications

```
position: fixed, bottom: calc(72px + env(safe-area-inset-bottom)), left: 16px, right: 16px
max-width: 480px, margin: 0 auto
bg: var(--color-text-primary) — inverted surface
text: var(--color-bg-elevated)
radius: var(--radius-lg)
padding: 12px 16px
shadow: var(--shadow-lg)
font: text-sm / weight 500 / Inter
Success variant: border-left 4px solid var(--color-success-text)
Error variant: border-left 4px solid var(--color-danger-text)
Auto-dismiss: 3000ms
Enter/exit: translateY(8px) → 0 + opacity 0 → 1, var(--duration-medium) var(--ease-enter)
```

---

## 6. Motion & animation

### Principles

- **Hardware-accelerated only.** Animate `transform` and `opacity` exclusively.
- **Never animate for decoration.** Every animation communicates: state change,
  hierarchy, direction, confirmation, or — for the two signature moments below — what's
  literally happening to her data.
- **Respect `prefers-reduced-motion`.** Wrap all non-essential animation in this query.
- **Two easing families, used consistently:** `ease-standard`/`enter`/`exit` for
  structural changes (open, close, expand, navigate). `ease-premium` for hover/focus on
  static interactive surfaces. Don't swap them — a hover that uses `ease-enter` reads
  as a glitch, not a polish.

### Duration rules

| Type | Duration | Easing | Examples |
|------|----------|--------|---------|
| Hover/focus colour | 150–200ms | `ease-premium` | Button hover, input focus border, rail-tab hover |
| Press | 100ms | `ease-spring` | Button active scale |
| Structural | 200ms | `ease-standard` | Status pill change, accordion-equivalent open/close |
| Enter | 300ms | `ease-enter` | Modals, sheets, toasts |
| Exit | 200ms | `ease-exit` | Sheets/toasts leaving — exit faster than enter |

### Signature motion #1 — the scan, not the spinner

The Upload screen's loading state is the single most characteristic moment in the
product: Gemini reading a photographed diary page. It is **not** a generic spinner or
dot-pulse. A thin Brass line sweeps once down the captured thumbnail (`translateY`,
`var(--duration-long)`-ish per pass, looping at `ease-standard`), with the instruction
text reinforcing what's happening ("Reading the page…"), not a content-free loading
label. Disable entirely under reduced-motion — show a static Brass-bordered thumbnail
instead.

### Signature motion #2 — the rail swap

Switching the open venue on Leads crossfades the spread's content (`opacity`, 150ms
out / 200ms in — exit faster than enter) while the rail's active border-left rule
animates with `ease-standard` 200ms. No slide, no layout-shifting reflow — the spread
swaps in place because it's the same "desk," just a different book open on it.

### Skeleton shimmer keyframe

```css
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--color-bg-sunken) 25%, var(--color-bg-elevated) 50%, var(--color-bg-sunken) 75%);
  background-size: 800px 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
```

---

## 7. Depth & elevation — rules, not shadows

A ledger is flat paper. Depth comes from **surface-tone shifts and rule lines**, not
elevation shadows. Reserve actual shadow for things that float above the page:

| Level | Use | Treatment |
|-------|-----|-----------|
| 0 — Sunken | Inset sections, the closed-tab rail | `bg-sunken`, no shadow |
| 1 — Base | Page surface | `bg-base`, no shadow |
| 2 — Page zone | The open spread, the dominant Upload zone | `bg-elevated`, no shadow, no border-radius box — a 1px `border-base` rule only where it meets its neighbour |
| 3 — Card | Secondary content (confirm cards, call cards) | `bg-elevated`, `border-base`, `shadow-xs` |
| 4 — Floating | Dropdown menus, popovers | `bg-elevated`, `border-strong`, `shadow-md` |
| 5 — Overlay | Modals, sheets, toasts | `shadow-lg`, no border |

---

## 8. Accessibility (WCAG 2.2 AA)

These are hard requirements, not suggestions.

### Contrast ratios

| Element | Minimum ratio |
|---------|--------------|
| Body text (≤18px) | **4.5:1** |
| Large text (≥18px / ≥14px bold) | **3:1** |
| UI components (input borders, icons) | **3:1** |
| Focus ring against adjacent bg | **3:1** |
| Status pill text on pill bg | **4.5:1** |

Pre-verified token combinations (dark / "Ink" mode, the primary experience):
- `text-primary` Parchment (#F2ECDD) on `bg-base` Ink (#15130F): ~15.8:1 ✅
- `text-secondary` (#B4A98F) on `bg-base`: ~7.9:1 ✅
- `accent-strong` text (#DCB75E) on `bg-base`: ~8.6:1 ✅ — use this, not `--color-accent`
  itself, for small Brass-coloured *text*; the base Brass fill (#C89B3C) is for buttons
  and dots where the contrast partner is the dark text/icon sitting on top of it, not
  Brass-as-text-color against Ink.
- `danger-text` (#E0897A) on `bg-base`: ~7.6:1 ✅ — the base Brick (#A8483B) is for
  fills/dots only; it's ~3:1 against Ink, large-text/icon-only territory.
- `success-text` (#A8C29A) on `bg-base`: ~8.9:1 ✅

In light/"Parchment" mode, recheck combinations the same way — `--color-accent-strong`
(#8C6A1F) is the light-mode Brass text colour for the identical reason.

### Touch targets

```
Minimum: 44 × 44px (WCAG 2.5.5)
Preferred: 48 × 48px for call / WhatsApp buttons on the call list, and for any quick-
            status control she taps repeatedly mid-call.

If a visible element is smaller (e.g. a 24px icon), add an invisible hit area:
.tap-target { position: relative; }
.tap-target::after { content: ''; position: absolute; inset: -10px; }
```

### Focus management

```
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
:focus:not(:focus-visible) { outline: none; }
```

### Semantic HTML rules

- Every interactive element is `<button>` or `<a>` — never a `<div>` with `onclick`.
- Status changes use `aria-live="polite"` so screen readers announce them.
- Form inputs always have a `<label>` — never rely on `placeholder` alone.
- Tables have proper `<th scope="col">` headers.
- Icon-only buttons have `aria-label`.
- Truncated text (table cells, long names) gets a `title` attribute as a fallback —
  never truncate with no way to read the full value.

---

## 9. Screen-specific design notes

### Upload screen — page + margin

- Below `--breakpoint-lg`: unchanged single-column mobile flow — the dropzone first,
  full-bleed, dominant; venue picker and CTA below it.
- At `--breakpoint-lg` and above: an asymmetric split (§4) — the dropzone/photo occupies
  the wide zone (~64%), full-bleed, no card border, with a bound-page left edge (a
  subtle inset shadow suggesting a notebook gutter). The venue picker, add-venue form,
  and submit CTA live in the narrower margin rail (~36%) on `bg-elevated`.
- The loading state is the scan-line signature motion (§6), not a spinner.
- "Step 1" overline lives in the margin rail above the venue picker, not floating over
  the photo — the photo is self-evidently the primary action and doesn't need a step
  counter on top of it.

### Leads screen — rail + open spread

- Below `--breakpoint-lg`: the venue rail collapses to a horizontal scrollable strip of
  tabs above the open spread; only one venue's table is rendered at a time.
- At `--breakpoint-lg` and above: a fixed-width rail (`--rail-width`) of closed venue
  tabs (§5) on `bg-sunken`, sorted by urgency (most follow-ups due first), paired with
  the open spread — the selected venue's full ledger table, full-bleed, on `bg-elevated`,
  no card border.
- Adding a venue is the trailing "+ venue" tab in the rail, not a separate page-header
  button — conceptually it's "add a new tab," not a disconnected toolbar action.
- Table rows get a mono row-number at the left edge (ledger line-numbering), hairline
  rules between rows (no zebra striping, no per-row card), and temperature-dot status
  pills (§3) in place of the old 7-hue category palette.
- Exactly one venue is open at a time — this is an interaction model change from
  independent per-venue accordions, not just a skin change.

### Confirm screen
- Source diary photo at top, sticky. Extracted cards below, scrollable — cards are
  correct here, this is secondary/review content, not the screen's one dominant zone.
- Ochre confidence chips appear inline with the flagged field label (not below it).
- "Save N bookings" button: full-width, sticky at bottom above the tab bar, primary CTA.

### Call list (the daily worklist)
- Cards stacked vertically, full-width, `p-4` — correct here, same reasoning as Confirm.
- Call and WhatsApp buttons: side by side, each `height: 52px`, `flex: 1`. Call uses
  Brass fill. WhatsApp keeps its brand green (`#22C55E`) — the one approved exception
  to the single-accent rule, since it's a third-party brand mark, not a UI accent.
- Quick status row below buttons: small pill buttons, `height: 44px` minimum (not 36px
  — these are tapped repeatedly mid-call). Border-only at rest; temperature-dot fill on
  active.

---

## 10. What Claude Code must do before building any UI component

1. Read the relevant token names from `@theme` (section 1). Use CSS variables, not
   hardcoded hex values.
2. Decide: is this component the screen's one dominant zone (no card chrome, §5/§7) or
   secondary content (a card)? Don't default every container to a card.
3. Check the component spec in section 5 before writing new component markup.
4. Borders are low-opacity rgba against the surface (§1B) — never a flat opaque grey.
5. Hover/focus transitions use `var(--ease-premium)`; structural open/close uses
   `var(--ease-standard)`. Don't mix them up.
6. After building: verify the WCAG contrast rule for every text-on-background
   combination, using the pre-verified pairs in §8 — note that `--color-accent` and
   `--color-danger-bg`'s paired *text* token are different shades from the base fill
   colour on purpose.
7. After building: confirm every interactive element is at least 44×44px on mobile.
8. Verify dark mode (the primary experience) by checking whether all CSS variables have
   a `.dark` override in `app.css`. Never hardcode a colour that lacks one.
9. Run `svelte-check` — fix all type errors before considering the component done.
