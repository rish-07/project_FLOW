# Build brief: Booking Capture & Follow-up app
## Stack: SvelteKit · Cloudflare Pages/Workers/D1/R2 · Drizzle ORM · BetterAuth · Gemini API

> ⚠️ **Partially superseded — historical reference.** This is the original brief. Naming and
> structure have since moved on; where this file disagrees with the current code or the docs
> below, **those win**:
> - **Data model:** `bookings` → **`leads`**, `vendors` → **`venues`** (`vendorId` → `venueId`).
>   The dashboard route/screen is **`/leads`**, not `/bookings`.
> - **File layout:** server-only modules live under **`src/lib/server/`** (`server/db/schema.ts`,
>   `server/auth.ts`, `server/gemini.ts`, `server/cleanup.ts`).
> - **Extraction:** confidence is scored for **all fields**, and today's IST date is injected
>   into the prompt at call time.
> - Authoritative now: `docs/implementation-phases.md` (build order), `docs/leads-page.md`
>   (CRM screen), `docs/design-system.md` (all UI), and the live `schema.ts`.

Paste this entire file into Claude Code as the project brief. Build in milestone order at the end.

---

## 1. Context & goal

The user is an **event organiser**. Multiple convention-hall vendors each keep a physical printed diary of bookings and send her **photos of diary pages** (via WhatsApp). Today she manually re-types every booking and dials each customer one by one.

This app removes that. She **logs in**, **uploads a diary photo**, picks the vendor, an AI model **reads the handwriting and extracts all bookings as structured data**, she **confirms the result** (editing any flagged fields), and it lands in a **dashboard** where she can tap-to-call, tap-to-WhatsApp, and track follow-up status per customer.

Build **mobile-first**. Design quality is a first-class requirement — see section 9.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Framework | SvelteKit + TypeScript |
| Styling | Tailwind CSS v4 |
| Adapter | `@sveltejs/adapter-cloudflare` |
| Hosting | Cloudflare Pages (SvelteKit SSR + server routes as Workers) |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM |
| ORM | Drizzle ORM (`drizzle-orm/d1`, `drizzle-orm/sqlite-core`) |
| File storage | Cloudflare R2 |
| Auth | BetterAuth (`better-auth`) with Drizzle adapter |
| AI extraction | Google Gemini (`gemini-2.5-flash`) via `@google/genai` SDK |
| Deployment | `wrangler pages deploy` or Cloudflare Pages Git integration |

---

## 3. Cloudflare setup

### wrangler.toml

```toml
name = "booking-app"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".svelte-kit/cloudflare"

[[d1_databases]]
binding = "DB"
database_name = "booking-db"
database_id = "REPLACE_AFTER_CREATE"

[[r2_buckets]]
binding = "DIARY_PHOTOS"
bucket_name = "booking-diary-photos"
```

### One-time CLI setup

```bash
# Authenticate
wrangler login

# Create D1 — copy the printed database_id into wrangler.toml
wrangler d1 create booking-db

# Create R2 bucket
wrangler r2 bucket create booking-diary-photos

# Secrets (never hardcoded — stored encrypted by Cloudflare)
wrangler secret put GEMINI_API_KEY        # from aistudio.google.com
wrangler secret put BETTER_AUTH_SECRET    # any random 32+ char string

# Apply migrations locally, then remotely after first deploy
wrangler d1 migrations apply booking-db --local
wrangler d1 migrations apply booking-db --remote
```

### Local development

```bash
npm run build
wrangler pages dev .svelte-kit/cloudflare
```

Wrangler simulates D1 and R2 locally. You must build first — wrangler needs the compiled output.

---

## 4. Type setup

### src/app.d.ts

```typescript
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { Session, User } from 'better-auth';

declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database;
        DIARY_PHOTOS: R2Bucket;
        GEMINI_API_KEY: string;
        BETTER_AUTH_SECRET: string;
      };
    }
    interface Locals {
      user: User | null;
      session: Session | null;
    }
  }
}

export {};
```

---

## 5. Drizzle schema

### src/lib/db/schema.ts

D1 is SQLite. All column types use `sqlite-core`. BetterAuth manages its own four tables (user, session, account, verification) — define them here alongside the app tables so migrations cover everything.

```typescript
import {
  sqliteTable, text, integer
} from 'drizzle-orm/sqlite-core';

// ── BetterAuth tables ──────────────────────────────────────────────

export const user = sqliteTable('user', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  email:         text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image:         text('image'),
  createdAt:     integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt:     integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const session = sqliteTable('session', {
  id:        text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  token:     text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId:    text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = sqliteTable('account', {
  id:                      text('id').primaryKey(),
  accountId:               text('account_id').notNull(),
  providerId:              text('provider_id').notNull(),
  userId:                  text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken:             text('access_token'),
  refreshToken:            text('refresh_token'),
  idToken:                 text('id_token'),
  accessTokenExpiresAt:    integer('access_token_expires_at', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt:   integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
  scope:                   text('scope'),
  password:                text('password'),
  createdAt:               integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt:               integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id:         text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value:      text('value').notNull(),
  expiresAt:  integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt:  integer('created_at', { mode: 'timestamp_ms' }),
  updatedAt:  integer('updated_at', { mode: 'timestamp_ms' }),
});

// ── App tables ─────────────────────────────────────────────────────

export const vendors = sqliteTable('vendors', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:      text('name').notNull(),
  phone:     text('phone'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
});

export const bookings = sqliteTable('bookings', {
  id:                   text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId:            text('session_id').notNull(), // groups pending bookings from one upload
  vendorId:             text('vendor_id').notNull().references(() => vendors.id),
  customerName:         text('customer_name').notNull(),
  // event_type: one of Marriage | Engagement | Reception | Sangeet | Birthday | Other
  eventType:            text('event_type').notNull(),
  eventDate:            text('event_date').notNull(),   // YYYY-MM-DD
  eventTime:            text('event_time').notNull().default(''),
  phonePrimary:         text('phone_primary').notNull(),
  phoneSecondary:       text('phone_secondary'),
  // status: new | no_answer | interested | quoted | booked | not_interested | callback
  status:               text('status').notNull().default('new'),
  notes:                text('notes'),
  nextFollowupOn:       text('next_followup_on'),       // YYYY-MM-DD
  lastContactedAt:      integer('last_contacted_at', { mode: 'timestamp_ms' }),
  sourceImageKey:       text('source_image_key'),       // R2 object key
  extractionConfidence: text('extraction_confidence'),  // JSON string of per-field scores
  isConfirmed:          integer('is_confirmed', { mode: 'boolean' }).notNull().default(false),
  createdAt:            integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
});

export type Vendor  = typeof vendors.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
```

### src/lib/db/index.ts

```typescript
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}
```

### drizzle.config.ts

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema:  './src/lib/db/schema.ts',
  out:     './drizzle/migrations',
  dialect: 'sqlite',
  driver:  'd1-http',
  dbCredentials: {
    accountId:  process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token:      process.env.CLOUDFLARE_D1_TOKEN!,
  },
} satisfies Config;
```

Generate migrations: `npx drizzle-kit generate`
Apply locally:       `wrangler d1 migrations apply booking-db --local`
Apply remotely:      `wrangler d1 migrations apply booking-db --remote`

---

## 6. BetterAuth setup

### src/lib/auth.ts

```typescript
import { betterAuth }      from 'better-auth';
import { drizzleAdapter }  from 'better-auth/adapters/drizzle';
import { createDb }        from '$lib/db';
import * as schema         from '$lib/db/schema';

export function createAuth(d1: D1Database, secret: string) {
  const db = createDb(d1);

  return betterAuth({
    secret,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user:         schema.user,
        session:      schema.session,
        account:      schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    trustedOrigins: [
      'http://localhost:5173',
      'http://localhost:8788',          // wrangler pages dev
      'https://booking-app.pages.dev',  // replace with real CF Pages URL after deploy
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
```

### src/hooks.server.ts

```typescript
import { createAuth }  from '$lib/auth';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const auth = createAuth(
    event.platform!.env.DB,
    event.platform!.env.BETTER_AUTH_SECRET
  );

  // Delegate all /api/auth/* routes to BetterAuth
  if (event.url.pathname.startsWith('/api/auth')) {
    return auth.handler(event.request);
  }

  // Attach session + user to locals for every other route
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  event.locals.user    = session?.user    ?? null;
  event.locals.session = session?.session ?? null;

  // Redirect unauthenticated users to login (except /login itself)
  if (!event.locals.user && event.url.pathname !== '/login') {
    return Response.redirect(new URL('/login', event.url), 302);
  }

  return resolve(event);
};
```

### src/routes/api/auth/[...all]/+server.ts

```typescript
import { createAuth } from '$lib/auth';
import type { RequestHandler } from './$types';

const handler: RequestHandler = async ({ request, platform }) => {
  const auth = createAuth(platform!.env.DB, platform!.env.BETTER_AUTH_SECRET);
  return auth.handler(request);
};

export const GET  = handler;
export const POST = handler;
```

### Login page — src/routes/login/+page.svelte

Simple email + password form. On submit POST to `/api/auth/sign-in/email` (BetterAuth's built-in endpoint). On success redirect to `/upload`.

BetterAuth also provides a client helper:

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
});
```

Use `authClient.signIn.email({ email, password })` from the login page's submit handler. On success, `goto('/upload')`.

Provide a sign-out button in the layout: `authClient.signOut()` then `goto('/login')`.

### First-run user creation

Since there is no public registration, create the first user via BetterAuth's API directly (or via a one-time `+page.server.ts` admin action behind an env-flag). Alternatively, expose a temporary `/setup` route that creates the user, then lock it.

A simple approach: in the hooks, if zero users exist in D1 and the request is to `/setup`, allow it through unauthenticated. The `/setup` page has a one-time form to create the owner account. After creation, remove or gate that route.

---

## 7. AI extraction

### Extraction prompt — use this verbatim in the API call

```
You are extracting event bookings from a photo of a vendor's physical booking diary.
The diary has PRINTED date headers or slot labels, and the bookings are HANDWRITTEN under them.

Extract EVERY booking visible in the image. One image often contains multiple bookings — return all of them.

For each booking, extract:
- customer_name: the customer's full name (string)
- event_type: one of [Marriage, Engagement, Reception, Sangeet, Birthday, Other]. If unclear, use "Other".
- event_date: YYYY-MM-DD. The date comes from the PRINTED slot header the entry sits under.
  If no year is written, infer the next upcoming date that is not in the past.
- event_time: as written (e.g. "7:30 PM", "evening"). Empty string if absent.
- phone_primary: normalised to +91XXXXXXXXXX (Indian 10-digit). Strip spaces and dashes.
- phone_secondary: second number if present, same format. null if absent.
- confidence: object with 0–1 scores for customer_name, event_date, phone_primary.
  Be honest — ambiguous digits score below 0.7.

Handwriting may mix English, Hindi, and Telugu — read all three.

Return ONLY a valid JSON array. No markdown, no commentary. Example:
[
  {
    "customer_name": "Ravi Kumar",
    "event_type": "Marriage",
    "event_date": "2026-11-23",
    "event_time": "7:00 PM",
    "phone_primary": "+919876543210",
    "phone_secondary": null,
    "confidence": { "customer_name": 0.95, "event_date": 0.9, "phone_primary": 0.75 }
  }
]
```

### src/lib/gemini.ts

```typescript
import { GoogleGenAI }  from '@google/genai';
import { z }            from 'zod';

const BookingSchema = z.object({
  customer_name:    z.string(),
  event_type:       z.enum(['Marriage','Engagement','Reception','Sangeet','Birthday','Other']),
  event_date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event_time:       z.string(),
  phone_primary:    z.string(),
  phone_secondary:  z.string().nullable(),
  confidence:       z.object({
    customer_name:  z.number().min(0).max(1),
    event_date:     z.number().min(0).max(1),
    phone_primary:  z.number().min(0).max(1),
  }),
});

export type ExtractedBooking = z.infer<typeof BookingSchema>;

export async function extractBookings(
  imageBuffer: ArrayBuffer,
  apiKey: string
): Promise<ExtractedBooking[]> {
  const ai     = new GoogleGenAI({ apiKey });
  const base64 = Buffer.from(imageBuffer).toString('base64');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        { text: '<paste the full prompt from above>' },
      ],
    }],
    config: { responseMimeType: 'application/json' },
  });

  const raw    = response.text ?? '';
  const clean  = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  return z.array(BookingSchema).parse(parsed);
}
```

### src/routes/api/extract/+server.ts

```typescript
import { json, error }        from '@sveltejs/kit';
import { extractBookings }    from '$lib/gemini';
import { createDb }           from '$lib/db';
import { bookings }           from '$lib/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  const formData  = await request.formData();
  const file      = formData.get('file') as File | null;
  const vendorId  = formData.get('vendor_id') as string | null;

  if (!file || !vendorId) throw error(400, 'Missing file or vendor_id');

  const buffer    = await file.arrayBuffer();
  const imageKey  = `diary-photos/${vendorId}/${Date.now()}.jpg`;
  const sessionId = crypto.randomUUID();

  // 1. Store photo in R2
  await platform!.env.DIARY_PHOTOS.put(imageKey, buffer, {
    httpMetadata: { contentType: 'image/jpeg' },
  });

  // 2. Extract with Gemini
  const extracted = await extractBookings(buffer, platform!.env.GEMINI_API_KEY);

  // 3. Insert as unconfirmed bookings
  const db = createDb(platform!.env.DB);
  await db.insert(bookings).values(
    extracted.map(b => ({
      sessionId,
      vendorId,
      customerName:          b.customer_name,
      eventType:             b.event_type,
      eventDate:             b.event_date,
      eventTime:             b.event_time,
      phonePrimary:          b.phone_primary,
      phoneSecondary:        b.phone_secondary,
      sourceImageKey:        imageKey,
      extractionConfidence:  JSON.stringify(b.confidence),
      isConfirmed:           false,
    }))
  );

  return json({ session_id: sessionId, count: extracted.length });
};
```

---

## 8. SvelteKit file structure

```
src/
  routes/
    +layout.svelte              # sticky bottom tab bar, global nav
    login/
      +page.svelte              # email + password login form
    setup/
      +page.svelte              # one-time owner account creation
      +page.server.ts           # guard: only if zero users exist
    upload/
      +page.svelte              # photo upload + vendor picker
    confirm/
      +page.svelte              # editable extracted booking cards
      +page.server.ts           # load pending by ?session=
    bookings/
      +page.svelte              # full dashboard: table, filters, search
      +page.server.ts           # load bookings with filters + session check
    calls/
      +page.svelte              # today's prioritised call list
      +page.server.ts           # load worklist + session check
    api/
      auth/
        [...all]/
          +server.ts            # BetterAuth handler (GET + POST)
      extract/
        +server.ts              # POST: R2 upload + Gemini extract
      bookings/
        +server.ts              # GET list, PATCH status/notes
        [id]/
          +server.ts            # PATCH single booking
      vendors/
        +server.ts              # GET list, POST create
      photos/
        [key]/
          +server.ts            # GET: stream photo from R2 (for confirm screen)
  lib/
    auth.ts                     # createAuth factory
    auth-client.ts              # BetterAuth Svelte client
    db/
      schema.ts
      index.ts
    gemini.ts
    types.ts                    # shared TypeScript types, status colour map
    utils.ts                    # phone formatting, date helpers
  hooks.server.ts               # session injection + auth routing + redirect guard
  app.d.ts
drizzle/
  migrations/
wrangler.toml
drizzle.config.ts
```

---

## 9. Screens & features

Mobile-first. **Sticky bottom tab bar** — three tabs: Upload, Bookings, Calls. Login and Setup are full-screen standalone routes outside the tab layout.

### Login (`/login`)

Clean centred card. Email + password fields. "Sign in" button. On success → `/upload`. No registration link (the app is single-user; account is created via `/setup`).

### Setup (`/setup`) — one-time

Guard in `+page.server.ts`: if any user already exists in D1, redirect to `/login`. Otherwise render a simple form to create the owner account. After creation, redirect to `/login`. This route effectively self-destructs after first use.

### Upload (Tab 1 — `/upload`)

- Full-width tap-to-upload zone with camera capture (`accept="image/*" capture="environment"`).
- Vendor dropdown (seeded from `vendors` table). Inline "Add vendor" expander — no modal.
- Submit → `fetch('POST /api/extract', formData)`.
- Loading overlay: "Reading the diary page…" with a subtle animation.
- On success → `goto('/confirm?session=' + session_id)`.
- On error → inline error card with "Try again."

### Confirm (`/confirm?session=`) — the safety net

Load function reads bookings with `isConfirmed = false` and matching `session_id`.

Shows each booking as an **editable card** with all fields inline. Apply these rules:
- **Any field with confidence < 0.75 gets an amber warning chip** — "Double-check". Especially phones.
- Each card has a delete (✕) icon to remove a misread booking.
- Show the source diary photo above the cards (served from `/api/photos/[key]` as a signed R2 stream).
- "Save [n] bookings" button at bottom: PATCHes `isConfirmed = true` on the set, then `goto('/bookings')`.
- Do NOT skip this screen or auto-save — a wrong phone digit = a wasted call.

### Bookings (Tab 2 — `/bookings`)

Full booking list. Load function:
- `search` param → filter by name or phone (SQLite `LIKE`)
- `vendor` param → filter by vendor_id
- `status` param → filter by status
- Default sort: `event_date ASC` (soonest event first)

Each row shows: customer name · event type pill · event date (human: "Mon 23 Nov") · vendor chip · status pill.

Row actions (tap to expand or swipe):
- **Call** → `<a href="tel:+91XXXXXXXXXX">`. Also PATCHes `last_contacted_at = now()`.
- **WhatsApp** → `<a href="https://wa.me/91XXXXXXXXXX" target="_blank">`. (No `+` in `wa.me` URLs.)
- **Status** → one-tap dropdown, saves immediately.
- **Notes** → tap to add/edit inline.
- **Follow-up date** → date picker, visible only when status = 'callback'.

### Calls (Tab 3 — `/calls`)

Today's worklist. Filter: `status IN ('new','no_answer','callback')` AND (`next_followup_on IS NULL` OR `next_followup_on <= today`). Sort: `event_date ASC`.

For each booking: name + event type + event date + vendor + two large tap-targets (📞 Call, 💬 WhatsApp) + quick status row (No answer · Interested · Booked · Not interested · Callback). One tap saves the status. "Callback" reveals a compact date picker for `next_followup_on`.

---

## 10. Design direction — make it look advanced

Treat this as a purpose-built product, not a CRUD template.

**Typography:** Inter or Geist. Screen titles: 28–32px / weight 600. Section labels: 12px / uppercase / 0.05em tracking. Body: 15px / weight 400. Tabular numbers in mono for phone numbers. Never cramped.

**Color system:** warm neutral base (near-white in light, near-black in dark). One accent color (indigo-600 or teal-600) for primary actions and active tab only. Status pills use muted, low-saturation color per status:

| Status | Color direction |
|---|---|
| new | neutral gray |
| no_answer | amber |
| interested | blue |
| quoted | purple |
| booked | green |
| not_interested | red/muted |
| callback | orange |

**Cards:** 12px radius, single hairline border (`border border-neutral-200 dark:border-neutral-800`), no box-shadow. Slight background contrast (`bg-white` cards on `bg-neutral-50` page).

**Bottom tab bar:** safe-area-aware (`pb-[env(safe-area-inset-bottom)]`), blur-backdrop, border-top. Active tab: accent color icon + label. Inactive: neutral muted.

**Empty states:** every tab needs a real one — icon, one-line message, CTA. No blank screens.

**Loading:** skeleton shimmer for the bookings list. Animated pulse on upload loading overlay. Status changes: optimistic update immediately, confirm from server.

**Micro-interactions:** 150ms ease transitions on hover/press/state. A "Saved!" toast when bookings are confirmed. Status pill change animates smoothly.

**Dark mode:** full `dark:` Tailwind variants throughout. Both modes are first-class.

**Mobile craft:** generous touch targets (min 44px height). Bottom tab bar always reachable by thumb. The confirm screen and call list are the two hero screens — give them extra design care.

---

## 11. Build order (milestones)

Work through each milestone before starting the next. Each should be individually testable.

| # | Milestone | Notes |
|---|---|---|
| 1 | Scaffold | SvelteKit + TS + Tailwind + adapter-cloudflare. Design tokens. Bottom tab layout. |
| 2 | Cloudflare wiring | `wrangler.toml`, `app.d.ts`, D1 + R2 bindings verified locally with `wrangler pages dev`. |
| 3 | Drizzle schema + migrations | All tables (BetterAuth + app). Generate and apply locally. |
| 4 | BetterAuth | `auth.ts`, `hooks.server.ts`, auth API route, login page, setup page. Verify login/logout flow. Seed test vendor. |
| 5 | Extract route | `POST /api/extract` → R2 upload → Gemini call → insert unconfirmed bookings → return session_id. Test with a real diary photo. |
| 6 | Confirm screen | Load by session_id, editable cards, confidence flagging, save action. Photo preview from R2. |
| 7 | Bookings dashboard | Load function, table/cards, search, filters, status pills, tap-to-call, WhatsApp, status updates. |
| 8 | Call list | Today's worklist, priority sort, one-tap status logging, callback date picker. |
| 9 | Polish | Empty states, skeletons, toasts, transitions, dark mode, mobile QA on a real device. |

---

## 12. Gotchas for this stack

**Workers runtime ≠ Node.js full API.** Use `compatibility_flags = ["nodejs_compat"]` so `Buffer` is available. Without it, `Buffer.from(imageBuffer).toString('base64')` in `gemini.ts` will throw.

**D1 is SQLite, not Postgres.** No native `uuid` type → use `text`. No boolean → use `integer (0/1)` with `{ mode: 'boolean' }`. Date arithmetic uses ISO string text comparison (`WHERE event_date <= '2026-12-31'`). This all works fine — just be aware.

**BetterAuth instance per request.** Because `platform.env` is only available at request time in Workers, `createAuth()` is called inside hooks and handlers, not at module level. This is a thin factory — BetterAuth is designed for this pattern. No performance concern.

**R2 has no public URLs.** To display the diary photo on the confirm screen, create a `/api/photos/[key]` route that streams the R2 object: `platform.env.DIARY_PHOTOS.get(key)` → pipe the body as the response. Or generate a presigned URL: `platform.env.DIARY_PHOTOS.createSignedUrl(key, { expiresIn: 3600 })` (requires R2 CORS + public access configured).

**Session state between upload → confirm.** Pass `session_id` as a URL query param (`/confirm?session=abc123`). The confirm page's `load` function reads it and queries D1. Never use `localStorage` or `sessionStorage` — they don't work with SvelteKit SSR.

**`wa.me` URL format.** WhatsApp deep links use no `+` sign: `https://wa.me/919876543210` not `https://wa.me/+919876543210`.

**Gemini API key location.** `GEMINI_API_KEY` lives in `platform.env` (a Cloudflare secret). Never import `gemini.ts` from a `+page.svelte` — only from `+server.ts` or `+page.server.ts`. The key must never reach the browser.

**BetterAuth `trustedOrigins`.** Update the list in `auth.ts` with the real Cloudflare Pages URL after first deploy. Mismatches cause silent auth failures.

---

## 13. Definition of done

- She logs in with email + password.
- She uploads a diary photo, picks a vendor, and within seconds sees all extracted bookings.
- Low-confidence fields (especially phones) are visually flagged before saving.
- Saved bookings appear in the dashboard, filterable and searchable.
- One tap calls a customer. One tap opens WhatsApp. One tap logs a status.
- The UI looks like a premium, intentional product in both light and dark mode.
- The Gemini API key is never exposed to the client.
- All data mutations go through server routes — no direct D1 calls from the browser.
- Auth protects every route. An unauthenticated request is redirected to `/login`.
