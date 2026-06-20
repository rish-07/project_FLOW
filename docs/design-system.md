# Design system
## Booking Capture & Follow-up — SvelteKit + Tailwind v4

This file is the single source of truth for every visual decision in the app.
Claude Code must read and apply this before building or modifying any UI component.

---

## 0. Philosophy

This is a **working tool, not a marketing page.** Your client uses it under pressure —
on her phone, mid-call, in bad lighting. Every design decision optimises for:

1. **Speed of comprehension.** She must read a booking row and act in under two seconds.
2. **Tap confidence.** Buttons and status actions are large, spaced, and forgiving.
3. **Trust through precision.** Numbers, dates, and names look exact and deliberate — not casual.
4. **Premium calm.** The app feels considered and intentional, not generic. Dark mode first.

When in doubt, choose the option that is **quieter** — less colour, less shadow, less motion.
Restraint is the premium signal. Noise is the cheap signal.

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
  --font-sans:  "Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono:  "JetBrains Mono", "Fira Code", ui-monospace, monospace;

  /* ── Type scale  (Major Third — 1.25× ratio, base 16px) ─────────────── */
  --text-2xs:   0.625rem;   /* 10px  — labels, badges           */
  --text-xs:    0.75rem;    /* 12px  — captions, helper text     */
  --text-sm:    0.875rem;   /* 14px  — secondary body            */
  --text-base:  1rem;       /* 16px  — primary body              */
  --text-lg:    1.25rem;    /* 20px  — large body / sub-heading  */
  --text-xl:    1.5rem;     /* 24px  — H4                        */
  --text-2xl:   1.875rem;   /* 30px  — H3                        */
  --text-3xl:   2.375rem;   /* 38px  — H2                        */
  --text-4xl:   3rem;       /* 48px  — H1 / screen titles        */

  /* ── Line heights ───────────────────────────────────────────────────── */
  --leading-none:    1;
  --leading-tight:   1.2;   /* headings                          */
  --leading-snug:    1.35;  /* sub-headings                      */
  --leading-normal:  1.5;   /* body text                         */
  --leading-relaxed: 1.65;  /* long-form reading                 */

  /* ── Letter spacing ─────────────────────────────────────────────────── */
  --tracking-tighter: -0.03em;  /* H1, H2 — large display        */
  --tracking-tight:   -0.02em;  /* H3, H4                        */
  --tracking-normal:   0em;     /* body                          */
  --tracking-wide:     0.04em;  /* labels, badges (caps)         */
  --tracking-wider:    0.08em;  /* overlines                     */

  /* ── Spacing (8-point grid) ─────────────────────────────────────────── */
  /* Every spacing value is a multiple of 8px (0.5rem).                   */
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

  /* ── Border radius ──────────────────────────────────────────────────── */
  --radius-sm:   0.375rem;  /*  6px — tags, badges              */
  --radius-md:   0.625rem;  /* 10px — inputs, buttons           */
  --radius-lg:   0.875rem;  /* 14px — cards                     */
  --radius-xl:   1.25rem;   /* 20px — bottom sheets, modals     */
  --radius-full: 9999px;    /* pills                            */

  /* ── Breakpoints ────────────────────────────────────────────────────── */
  --breakpoint-sm:  480px;   /* large phone landscape            */
  --breakpoint-md:  768px;   /* tablet                           */
  --breakpoint-lg:  1024px;  /* desktop                         */
  --breakpoint-xl:  1280px;  /* wide desktop                    */

  /* ── Colours — Light mode ───────────────────────────────────────────── */

  /* Background surfaces (60% of the palette) */
  --color-bg-base:        #FAFAF9;  /* warm off-white page bg       */
  --color-bg-elevated:    #FFFFFF;  /* cards, inputs                */
  --color-bg-sunken:      #F3F2F0;  /* inset sections, alt rows     */
  --color-bg-overlay:     rgba(15, 17, 23, 0.5);  /* modal scrim  */

  /* Structure & text (30% of the palette) */
  --color-text-primary:   #0F1117;  /* rich off-black — not pure #000 */
  --color-text-secondary: #4B5060;  /* secondary labels              */
  --color-text-tertiary:  #878C9B;  /* hints, placeholders           */
  --color-text-inverse:   #FAFAF9;  /* text on dark/accent bg        */
  --color-border-base:    rgba(15, 17, 23, 0.1);   /* hairline      */
  --color-border-strong:  rgba(15, 17, 23, 0.18);  /* inputs        */
  --color-border-focus:   #0D9488;  /* focus ring (accent)           */

  /* Accent — teal (10% of the palette) */
  /* Used ONLY for: primary CTA, active tab, links, focus rings.          */
  /* Never use for decorative elements.                                    */
  --color-accent:         #0D9488;  /* teal-600                     */
  --color-accent-hover:   #0F766E;  /* teal-700                     */
  --color-accent-subtle:  #CCFBF1;  /* teal-100 — chip bg           */
  --color-accent-text:    #134E4A;  /* teal-900 — text on subtle    */

  /* Status colours — muted, accessible, never full-saturation */
  --color-status-new-bg:           #F1F5F9;
  --color-status-new-text:         #334155;
  --color-status-no-answer-bg:     #FFFBEB;
  --color-status-no-answer-text:   #92400E;
  --color-status-interested-bg:    #EFF6FF;
  --color-status-interested-text:  #1E40AF;
  --color-status-quoted-bg:        #F5F3FF;
  --color-status-quoted-text:      #4C1D95;
  --color-status-booked-bg:        #F0FDF4;
  --color-status-booked-text:      #14532D;
  --color-status-not-int-bg:       #FEF2F2;
  --color-status-not-int-text:     #7F1D1D;
  --color-status-callback-bg:      #FFF7ED;
  --color-status-callback-text:    #7C2D12;

  /* Semantic feedback */
  --color-warning-bg:    #FFFBEB;
  --color-warning-text:  #92400E;
  --color-warning-icon:  #D97706;
  --color-danger-bg:     #FEF2F2;
  --color-danger-text:   #7F1D1D;
  --color-success-bg:    #F0FDF4;
  --color-success-text:  #14532D;

  /* ── Shadows ────────────────────────────────────────────────────────── */
  /* No harsh single-layer shadows. Use soft, multi-layer stacks.          */
  --shadow-xs:  0 1px 2px rgba(15, 17, 23, 0.05);
  --shadow-sm:  0 1px 3px rgba(15, 17, 23, 0.08), 0 1px 2px rgba(15, 17, 23, 0.04);
  --shadow-md:  0 4px 8px rgba(15, 17, 23, 0.07), 0 2px 4px rgba(15, 17, 23, 0.04);
  --shadow-lg:  0 12px 24px rgba(15, 17, 23, 0.09), 0 4px 8px rgba(15, 17, 23, 0.04);
  --shadow-inset: inset 0 1px 2px rgba(15, 17, 23, 0.06);

  /* ── Transitions ────────────────────────────────────────────────────── */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);   /* most interactions  */
  --ease-enter:    cubic-bezier(0.0, 0.0, 0.2, 1);  /* elements entering  */
  --ease-exit:     cubic-bezier(0.4, 0.0, 1, 1);    /* elements leaving   */
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1); /* satisfying pop   */

  --duration-fast:   100ms;
  --duration-short:  150ms;
  --duration-base:   200ms;
  --duration-medium: 300ms;
  --duration-long:   400ms;

}

/* ── Dark mode token overrides ──────────────────────────────────────────── */
/* Applied via class="dark" on <html>. SvelteKit should read the OS         */
/* preference and set this on SSR to avoid flash.                           */
.dark {
  --color-bg-base:        #0F1117;  /* deep off-black                */
  --color-bg-elevated:    #181C27;  /* cards, inputs                 */
  --color-bg-sunken:      #0B0E15;  /* inset sections                */
  --color-bg-overlay:     rgba(0, 0, 0, 0.65);

  --color-text-primary:   #F0F0EE;  /* warm off-white                */
  --color-text-secondary: #9CA3AF;
  --color-text-tertiary:  #6B7280;
  --color-text-inverse:   #0F1117;
  --color-border-base:    rgba(240, 240, 238, 0.08);
  --color-border-strong:  rgba(240, 240, 238, 0.14);

  --color-accent:         #2DD4BF;  /* teal-400 — brighter on dark   */
  --color-accent-hover:   #5EEAD4;  /* teal-300                      */
  --color-accent-subtle:  rgba(45, 212, 191, 0.12);
  --color-accent-text:    #CCFBF1;

  --color-status-new-bg:           rgba(51, 65, 85, 0.4);
  --color-status-new-text:         #94A3B8;
  --color-status-no-answer-bg:     rgba(120, 53, 15, 0.25);
  --color-status-no-answer-text:   #FCD34D;
  --color-status-interested-bg:    rgba(30, 64, 175, 0.2);
  --color-status-interested-text:  #93C5FD;
  --color-status-quoted-bg:        rgba(76, 29, 149, 0.2);
  --color-status-quoted-text:      #C4B5FD;
  --color-status-booked-bg:        rgba(20, 83, 45, 0.25);
  --color-status-booked-text:      #86EFAC;
  --color-status-not-int-bg:       rgba(127, 29, 29, 0.2);
  --color-status-not-int-text:     #FCA5A5;
  --color-status-callback-bg:      rgba(124, 45, 18, 0.2);
  --color-status-callback-text:    #FDBA74;

  --color-warning-bg:    rgba(120, 53, 15, 0.2);
  --color-warning-text:  #FCD34D;
  --color-warning-icon:  #F59E0B;
  --color-danger-bg:     rgba(127, 29, 29, 0.2);
  --color-danger-text:   #FCA5A5;
  --color-success-bg:    rgba(20, 83, 45, 0.2);
  --color-success-text:  #86EFAC;

  --shadow-xs:  0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-sm:  0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md:  0 4px 8px rgba(0, 0, 0, 0.35), 0 2px 4px rgba(0, 0, 0, 0.2);
  --shadow-lg:  0 12px 24px rgba(0, 0, 0, 0.45), 0 4px 8px rgba(0, 0, 0, 0.2);
}
```

---

## 2. Typography

### Font loading (src/app.html)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Type scale reference

| Token     | Size  | Weight | Leading      | Tracking    | Usage                          |
|-----------|-------|--------|--------------|-------------|-------------------------------|
| `text-4xl`| 48px  | 700    | tight (1.2)  | tighter     | Screen titles (rare)          |
| `text-3xl`| 38px  | 700    | tight (1.2)  | tighter     | H2, hero headings             |
| `text-2xl`| 30px  | 600    | snug (1.35)  | tight       | H3, section titles            |
| `text-xl` | 24px  | 600    | snug (1.35)  | tight       | H4, card headings             |
| `text-lg` | 20px  | 500    | normal (1.5) | normal      | Sub-headings, large labels    |
| `text-base`| 16px | 400    | normal (1.5) | normal      | Primary body, table cells     |
| `text-sm` | 14px  | 400    | normal (1.5) | normal      | Secondary body, descriptions  |
| `text-xs` | 12px  | 500    | normal (1.5) | wide        | Labels, chips, captions       |
| `text-2xs`| 10px  | 500    | none (1.0)   | wider       | Overlines only                |

**The rule: tracking tightens as size grows, loosens as size shrinks.**
Large display type optically gains air between letters as it scales up — pull it in.
Small caps-style labels optically lose air — push it out. Never use `tracking-normal`
above `text-xl` or below `text-sm`. This single rule is what separates "default browser
heading" from "someone made a typographic decision here."

**Dark mode weight bump:** In `.dark`, increment body weight by one step:
- 400 regular → 450 (or use `font-[450]` with Inter Variable)
- This counteracts halation — dark backgrounds make thin text feel lighter than it is.

### Fluid type — every heading scales with viewport, none are static `rem`

A static heading size looks correct at exactly one breakpoint and wrong everywhere
else — cramped on a 375px phone, undersized on a 1280px desktop. Every heading-level
size in this app is a `clamp()`, not a fixed token. The minimum is the mobile value,
the maximum is the desktop value, and the middle term does the scaling — tuned so the
size change tracks viewport change rather than just snapping between breakpoints.

```css
.text-display { font-size: clamp(1.875rem, 1.35rem + 2.6vw, 3rem);     letter-spacing: -0.03em; }  /* text-4xl */
.text-h2       { font-size: clamp(1.625rem, 1.25rem + 1.9vw, 2.375rem); letter-spacing: -0.03em; }  /* text-3xl */
.text-h3       { font-size: clamp(1.375rem, 1.15rem + 1.1vw, 1.875rem); letter-spacing: -0.02em; }  /* text-2xl */
.text-h4       { font-size: clamp(1.125rem, 1.0rem  + 0.6vw, 1.5rem);   letter-spacing: -0.02em; }  /* text-xl  */
```

Below `text-h4` (i.e. `text-lg` and smaller), do **not** use `clamp()` — body, label,
and caption sizes stay fixed. Fluid scaling exists to protect *display* type at the
extremes; it has no job at reading sizes, where it only introduces unpredictable
line-wrapping mid-sentence.

### Phone numbers and data

Phone numbers, dates, and booking IDs **must** use `font-mono` with `tabular-nums`.
This is non-negotiable — it signals precision and makes scanning faster:

```html
<span class="font-mono text-sm tabular-nums tracking-normal">+91 98765 43210</span>
```

---

## 3. Colour system

### The 60-30-10 rule (enforced)

- **60% — Backgrounds:** `bg-base`, `bg-elevated`, `bg-sunken`. Neutral, warm-toned.
  Nothing else should dominate visual weight.
- **30% — Structure:** Text, borders, icons, secondary surfaces. Creates hierarchy.
- **10% — Accent (teal):** Primary CTA buttons, active tab indicator, focus rings,
  and links only. If something is teal and it's not a primary action, remove it.

### Forbidden

- Pure `#000000` or `#FFFFFF` anywhere in the UI (use token values).
- Introducing new arbitrary colours outside the token system. If a colour isn't in
  `@theme`, it doesn't exist in this app.
- Using accent colour for decoration, borders, or hover states on non-primary elements.
- Relying on colour alone to communicate meaning — always pair colour with an icon or label.
- **Any multi-hue gradient as a background, card fill, or button fill** — specifically:
  purple-to-blue, pink-to-orange, or any `linear-gradient()`/`radial-gradient()` spanning
  more than one hue family. This is the single most recognisable "made by an AI" tell in
  UI right now, and it directly contradicts the calm/restraint philosophy in §0. A single
  app has exactly one accent hue (teal). If a surface needs visual interest, reach for a
  border, a shadow, or a change in surface token — never a gradient.
- Decorative blurred colour blobs / mesh gradients in the background of any screen.
- Saturating the accent colour above `--color-accent` for emphasis — if teal needs to
  "pop" harder, the actual fix is improving spacing or hierarchy, not raising saturation.

### Status pill colours

Status pills appear throughout the bookings and call list. Use these exact combinations:

```svelte
<!-- Svelte helper — map status to token classes -->
const STATUS_STYLES = {
  new:            'bg-[var(--color-status-new-bg)]          text-[var(--color-status-new-text)]',
  no_answer:      'bg-[var(--color-status-no-answer-bg)]    text-[var(--color-status-no-answer-text)]',
  interested:     'bg-[var(--color-status-interested-bg)]   text-[var(--color-status-interested-text)]',
  quoted:         'bg-[var(--color-status-quoted-bg)]        text-[var(--color-status-quoted-text)]',
  booked:         'bg-[var(--color-status-booked-bg)]        text-[var(--color-status-booked-text)]',
  not_interested: 'bg-[var(--color-status-not-int-bg)]       text-[var(--color-status-not-int-text)]',
  callback:       'bg-[var(--color-status-callback-bg)]      text-[var(--color-status-callback-text)]',
};
```

### Confidence warning (amber chip)

Fields extracted with `confidence < 0.75` get an amber warning indicator:

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
|----------------|-------|------|-----------------------------------------|
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
unrelated (two unrelated cards, a section and the next section's heading) sit at
`--spacing-4` or wider. Never let a "belongs together" gap and a "merely adjacent" gap
end up visually similar — that's what causes a reader to misgroup content.

**2. Breathing room is asymmetric, not box-model-uniform.** A card with `padding: 16px`
on all four sides reads as a CSS default, not a decision. Lead-in space (above a
heading, before the first line of a card) should be looser than trailing space (below
the last line, before a button row) — content needs more air to *arrive* than to
*leave*. Concretely, for any card or section with a heading + body + action:

```css
/* Asymmetric internal rhythm — not padding: 16px on every side */
.card-with-action {
  padding-top: var(--spacing-3);     /* 24px — generous lead-in above the heading   */
  padding-inline: var(--spacing-2);  /* 16px — gutter, symmetric is correct here    */
  padding-bottom: var(--spacing-2);  /* 16px — tighter trailing space before edge   */
}
.card-with-action .heading { margin-bottom: var(--spacing-1); }   /* 8px to body   */
.card-with-action .body    { margin-bottom: var(--spacing-3); }   /* 24px to action — body needs to visually finish before the CTA appears */
```

The jump from "tightly related" (8px) to "section boundary" (48px+) should never be
linear — skip a step. If a screen has three levels of grouping (field → card →
section), their gaps should be roughly geometric (8 → 24 → 64), not arithmetic
(16 → 32 → 48). Arithmetic spacing makes every grouping level look equally important;
geometric spacing makes hierarchy legible at a glance, before anyone reads a word.

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
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  background: rgba(var(--color-bg-elevated), 0.85);
  border-top: 1px solid var(--color-border-base);
}
```

---

## 5. Component specifications

### The interaction recipe — every component answers these four questions

No interactive element ships without an explicit answer to all four. "It'll just use
the browser default" is not an answer — it's how generic UI happens by accident.

| # | Question | Default answer for this app |
|---|----------|------------------------------|
| 1 | What changes on hover? | One property only — bg, border, or text colour. Never combine two colour changes on hover; save the second property change for active/focus. |
| 2 | What changes on press/active? | `transform: scale(0.97)` on tappable surfaces (buttons, cards, pills), `var(--ease-spring)`, 100ms. Never a colour change here — colour is hover's job, motion is press's job. |
| 3 | What's the easing? | `var(--ease-standard)` for colour/border/shadow. `var(--ease-spring)` only for scale/transform. Never `linear`, never default `ease`. |
| 4 | What's the duration? | 100–150ms for anything under the thumb (buttons, pills, tab items). 200ms for anything larger (cards, inputs). Never above 300ms for a hover/press response — past that it feels like lag, not intention. |

### Buttons

```
Primary CTA
  bg: var(--color-accent)
  text: var(--color-text-inverse)
  height: 48px (min — touch target)
  padding: 0 24px
  radius: var(--radius-md)
  font: 15px / weight 600 / tracking-normal
  transition: background var(--duration-short) var(--ease-standard),
              transform var(--duration-fast) var(--ease-spring),
              box-shadow var(--duration-short) var(--ease-standard)
  hover: bg → var(--color-accent-hover), shadow → var(--shadow-sm)
  active: transform scale(0.97)  ← spring ease, 100ms
  focus-visible: outline 2px var(--color-accent), outline-offset 2px

Secondary
  bg: transparent
  border: 1px solid var(--color-border-strong)
  text: var(--color-text-primary)
  (same sizing as primary)
  transition: background var(--duration-short) var(--ease-standard),
              border-color var(--duration-short) var(--ease-standard),
              transform var(--duration-fast) var(--ease-spring)
  hover: bg → var(--color-bg-sunken), border-color → var(--color-border-strong)
  active: transform scale(0.97)

Destructive
  bg: var(--color-danger-bg)
  text: var(--color-danger-text)
  transition: background var(--duration-short) var(--ease-standard),
              transform var(--duration-fast) var(--ease-spring)
  hover: bg darkens one step toward --color-danger-text (do not use opacity — opacity
         dims the text along with the background and hurts contrast right when the
         user is looking at a destructive action)
  active: transform scale(0.97)

Ghost (icon-only)
  bg: transparent
  icon: var(--color-text-secondary)
  size: 40×40px (min touch target)
  transition: background var(--duration-short) var(--ease-standard),
              color var(--duration-short) var(--ease-standard)
  hover: bg → var(--color-bg-sunken), icon colour → var(--color-text-primary)
  active: transform scale(0.94)  ← icon-only targets get a slightly stronger press cue
          since they have no text label to confirm the tap
```

### Cards

```
bg: var(--color-bg-elevated)
border: 1px solid var(--color-border-base)
radius: var(--radius-lg)   /* 14px */
padding: 20px (desktop) / 16px (mobile)
shadow: var(--shadow-xs)   /* barely-there lift */
hover: border-color → var(--color-border-strong), shadow → var(--shadow-sm)
transition: border-color var(--duration-short) var(--ease-standard),
            box-shadow var(--duration-short) var(--ease-standard)

Never use shadow alone without a border. The border provides structure in
both light and dark mode; shadow adds depth only on light mode.
```

### Form inputs

```
height: 48px
padding: 0 16px
bg: var(--color-bg-elevated)
border: 1px solid var(--color-border-strong)
radius: var(--radius-md)
font: text-base / weight 400
color: var(--color-text-primary)
placeholder: var(--color-text-tertiary)

focus:
  outline: none
  border-color: var(--color-accent)
  box-shadow: 0 0 0 3px var(--color-accent-subtle)   /* WCAG focus ring */
  transition: border-color var(--duration-short), box-shadow var(--duration-short)

error state:
  border-color: var(--color-danger-text)
  box-shadow: 0 0 0 3px var(--color-danger-bg)

Textarea: same as above, height auto, min-height 96px, padding 12px 16px
```

### Status pills

```
display: inline-flex, align-items: center
height: 24px
padding: 0 10px
radius: var(--radius-full)   /* pill */
font: text-xs / weight 500 / tracking-wide
text-transform: none  (use sentence case, not all-caps)
colours: see §3 status pill colours above

When a pill's status changes (e.g. quick-status tap on the call list):
  transition: background var(--duration-base) var(--ease-standard),
              color var(--duration-base) var(--ease-standard)
  On change, briefly scale 1 → 1.08 → 1 over 250ms (var(--ease-spring)) — this is the
  one moment a status pill is allowed to move; at rest it never animates.
```

### Confidence warning chip

```
Same shape as status pill.
bg: var(--color-warning-bg)
text: var(--color-warning-text)
Includes a ⚠ icon at 12px, 4px gap to the label text.
Applied to any extracted field with confidence < 0.75.
```

### Bottom tab bar — tab item

```
width: 33.33% (3 tabs)
height: 64px (+ safe area)
display: flex, flex-direction: column, align-items: center, justify-content: center
gap: 4px between icon and label

icon: 24px, Heroicons outline set
label: text-xs / weight 500

inactive:
  icon + label colour: var(--color-text-tertiary)
active:
  icon + label colour: var(--color-accent)
  icon: filled variant

transition: color var(--duration-short) var(--ease-standard)
No background change on active — colour alone is the signal.
```

### Skeleton loaders

```
bg: var(--color-bg-sunken)
radius: same as the element being replaced
animation: shimmer (see §6)

Skeleton widths are randomised within a range to feel organic:
  - Row title:   60–75% of container width
  - Sub-label:   40–55%
  - Badge:       48–64px fixed
```

### Toast notifications

```
position: fixed, bottom: calc(72px + env(safe-area-inset-bottom)),
          left: 16px, right: 16px  (mobile)
max-width: 480px, margin: 0 auto  (centers on wide screens)
bg: var(--color-text-primary)   ← inverted surface
text: var(--color-bg-elevated)
radius: var(--radius-lg)
padding: 12px 16px
shadow: var(--shadow-lg)
font: text-sm / weight 500

Success variant adds a green left border: border-left 4px solid var(--color-status-booked-text)
Error variant: red border
Auto-dismiss: 3000ms
Enter/exit: translateY(8px) → 0 + opacity 0 → 1, var(--duration-medium) var(--ease-enter)
```

---

## 6. Motion & animation

### Principles

- **Hardware-accelerated only.** Animate `transform` and `opacity` exclusively.
  Never animate `width`, `height`, `top`, `left`, `margin`, or `padding` — they
  trigger layout recalculation and cause jank on mobile.
- **Never animate for decoration.** Every animation must communicate something:
  state change, hierarchy, direction, confirmation.
- **Respect `prefers-reduced-motion`.** Wrap all non-essential animations in this media query.

### Duration rules

| Type | Duration | Easing | Examples |
|------|----------|--------|---------|
| Micro | 100ms | `ease-standard` | Hover colour, focus ring |
| Short | 150ms | `ease-standard` | Button press, icon swap |
| Standard | 200ms | `ease-standard` | Status pill change, input focus |
| Enter | 300ms | `ease-enter` | Modals, sheets sliding in |
| Exit | 200ms | `ease-exit` | Sheets sliding out |
| Spring | 150ms | `ease-spring` | Button active scale, confirm tick |

### Skeleton shimmer keyframe

```css
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-sunken) 25%,
    var(--color-bg-elevated) 50%,
    var(--color-bg-sunken) 75%
  );
  background-size: 800px 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
```

### Page transitions (SvelteKit)

On mobile, new screens slide in from the right (like native navigation).
Use SvelteKit's `<PageTransition>` or a wrapping component:

```css
/* Enter from right */
@keyframes slideInRight {
  from { transform: translateX(24px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
.page-enter { animation: slideInRight var(--duration-medium) var(--ease-enter); }

@media (prefers-reduced-motion: reduce) {
  .page-enter { animation: fade-in var(--duration-base) ease; }
}
```

---

## 7. Depth & elevation

Elevation is expressed through **layered soft shadows + border opacity**,
not through stark single-layer drop shadows or heavy gradients.

| Level | Use | Shadow | Border |
|-------|-----|--------|--------|
| 0 — Sunken | Inset sections, alternate rows | none | none |
| 1 — Base | Page surface | none | none |
| 2 — Raised | Cards, inputs | `shadow-xs` | `border-base` |
| 3 — Floating | Dropdowns, popovers | `shadow-md` | `border-strong` |
| 4 — Overlay | Modals, sheets | `shadow-lg` | none |

### Frosted glass (sticky nav + modals)

```css
/* Use sparingly — only sticky tab bar and modal overlays */
.glass {
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  background-color: rgba(var(--color-bg-elevated), 0.82);
}
```

---

## 8. Accessibility (WCAG 2.2 AA)

These are hard requirements, not suggestions.

### Contrast ratios

| Element | Minimum ratio | Check with |
|---------|--------------|-----------|
| Body text (≤18px) | **4.5:1** | webaim.org/resources/contrastchecker |
| Large text (≥18px / ≥14px bold) | **3:1** | same |
| UI components (input borders, icons) | **3:1** | same |
| Focus ring against adjacent bg | **3:1** | same |
| Status pill text on pill bg | **4.5:1** | same |

Pre-verified token combinations:
- `text-primary` (#0F1117) on `bg-elevated` (#FFFFFF): **18.4:1** ✅
- `text-secondary` (#4B5060) on `bg-elevated`: **7.1:1** ✅
- `accent` teal (#0D9488) on `bg-elevated`: **4.6:1** ✅
- `accent-text` (#134E4A) on `accent-subtle` (#CCFBF1): **7.2:1** ✅

In dark mode, recheck all combinations using the `.dark` token values above.

### Touch targets

```
Minimum: 44 × 44px (WCAG 2.5.5)
Preferred: 48 × 48px for call / WhatsApp buttons on the call list
            (she's tapping these while in a conversation — make them impossible to miss)

If a visible element is smaller (e.g. a 24px icon), add an invisible hit area:
.tap-target {
  position: relative;
}
.tap-target::after {
  content: '';
  position: absolute;
  inset: -10px;   /* extends tap area by 10px in all directions */
}
```

### Focus management

```
/* Always visible — never use outline: none without a replacement */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Suppress on mouse/touch, keep for keyboard */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Semantic HTML rules

- Every interactive element is `<button>` or `<a>` — never a `<div>` with `onclick`.
- Status changes use `aria-live="polite"` so screen readers announce them.
- Form inputs always have a `<label>` — never rely on `placeholder` alone.
- The bookings table has proper `<th scope="col">` headers.
- Icon-only buttons have `aria-label` (e.g. "Call Ravi Kumar").

---

## 9. Screen-specific design notes

### Upload screen
- The upload zone is **the entire viewport minus the tab bar** — full-bleed on mobile.
  This is the primary affordance; everything else is secondary.
- Camera icon at centre, `text-lg` instruction below it.
- Vendor dropdown below the zone, not above — don't crowd the main action.

### Confirm screen
- Source diary photo at top, sticky. Extracted cards below, scrollable.
- Each card: full-width, `var(--radius-lg)` corners, `shadow-xs`, `p-4` (16px) internal padding.
- Amber confidence chips appear directly inline with the flagged field label (not below it).
- "Save N bookings" button: full-width, sticky at bottom above tab bar, primary CTA style.

### Bookings dashboard
- Filter chips are a horizontal scroll row above the list — `gap-2`, no line breaks.
- Active filter chip: `bg-accent-subtle`, `text-accent-text`, `border-accent`.
- Row height: 72px (single-line info) or 88px (two-line). Never taller — keep scanning fast.
- Phone number cell: mono, tabular, right-aligned. Date cell: right-aligned, human format.
- Status pill: left-aligned within its cell, `w-[120px]` fixed to prevent column jitter.

### Call list (the daily worklist)
- Cards are stacked vertically, full-width, `p-4`.
- Call and WhatsApp buttons: side by side, each `height: 52px`, `flex: 1`.
  Call = primary accent fill. WhatsApp = green (`#22C55E`) fill.
  These are the most-tapped elements in the app — make them unmistakably large.
- Quick status row below buttons: 4–5 small pill buttons, `height: 36px`, `font-xs`.
  Tapping one immediately transitions to a green "Saved" state (optimistic update).
  Border-only style at rest; filled style on hover/active.

---

## 10. What Claude Code must do before building any UI component

1. Read the relevant token names from `@theme` (section 1). Use CSS variables, not
   hardcoded hex values.
2. Check the component spec in section 5 before writing new component markup.
3. After building: mentally verify the WCAG contrast rule for every text-on-background
   combination in the component.
4. After building: confirm every interactive element is at least 44×44px on mobile.
5. Verify dark mode by checking whether all CSS variables have a `.dark` override
   in `app.css`. Never hardcode a colour that lacks one.
6. Run `svelte-check` — fix all type errors before considering the component done.