# Voice Booking Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the organiser press-and-hold a "Record Voice" button on the upload screen, speak a list of bookings, and have them transcribed (Whisper) → extracted (Gemini) → land on the existing confirm screen as unconfirmed leads, with zero changes to the confirm screen itself.

**Architecture:** A new Workers AI binding (`AI`) runs `@cf/openai/whisper-large-v3-turbo` to transcribe an uploaded audio Blob to text. A new Gemini function (`extractBookingsFromText`) reuses the existing `BookingSchema` to turn that transcript into the same shape of booking objects the photo pipeline produces. A new endpoint (`/api/extract-voice`) wires these together and inserts unconfirmed `leads` rows exactly like `/api/extract` does, with `sourceImageKey` left `null` (decision below). The frontend adds a press-to-record button to `upload/+page.svelte` that posts the captured audio and redirects straight into `/confirm?session=...`.

**Tech Stack:** SvelteKit + TypeScript, Cloudflare Workers AI (Whisper), Google Gemini (`@google/genai`), Cloudflare R2, Drizzle/D1, native browser `MediaRecorder`.

## Decision: `sourceImageKey` vs. a new `sourceAudioKey` column

**Decision: leave `sourceImageKey` `null` for voice-originated leads. Do not add a `sourceAudioKey` column or any migration.**

Why this is safe to do with *zero* downstream changes: `src/routes/confirm/+page.server.ts:31-33` already builds `sourceImageKeys` by filtering out falsy keys —

```ts
const sourceImageKeys = [
  ...new Set(rows.map((r) => r.sourceImageKey).filter((k): k is string => !!k))
];
```

— and `confirm/+page.svelte:87` only renders the photo rail `{#if data.sourceImageKeys.length}`. A session whose every lead has `sourceImageKey: null` produces an empty array, so the photo rail simply doesn't render and every other field (name, event type, date, slot, phones, confidence chips) displays exactly as it does today. Adding a column and a migration would be speculative complexity for a screen that already degrades correctly — skip it.

The raw audio recording is still uploaded to R2 immediately (per the spec's compliance/tracking requirement), under its own key prefix (`voice-recordings/<venueId>/...`), but that key is **not** stored on any `leads` row. It is therefore outside `cleanupStaleLeads`'s orphan sweep (which only ever looks at `sourceImageKey`) — these audio files are a write-once compliance artifact, not a referenced asset. Building a second cleanup path for them is out of scope for this feature; flag it as a known follow-up if the organiser asks for one later, don't build it speculatively now.

## Global Constraints

- `nodejs_compat` must stay in `wrangler.toml` (already present) — required for `Buffer`, used by both the existing Gemini base64 encoding and the new Whisper base64 encoding.
- `createDb()` / `createAuth()` are created per-request, never at module scope (existing hard rule — the new endpoint follows this).
- All new server-side, secret-touching code lives under `src/lib/server/` (Gemini changes go in the existing `src/lib/server/gemini.ts`).
- The confirm screen's "extracted bookings are never auto-confirmed" safety rule applies identically to voice leads — they are inserted with `isConfirmed: false`, same as photo leads.
- This repo has **no automated tests for `+server.ts` routes** (no `@cloudflare/vitest-pool-workers` harness is configured — `vitest.config.ts` runs a plain Node environment for pure-logic unit tests only, and the existing `/api/extract` route has no test file). Follow that existing convention: verify the new endpoint and UI by running it for real (`npm run cf:dev` + manual curl / browser), not by writing Workers-runtime mocks that don't exist elsewhere in the codebase. The final task drives the whole flow end-to-end via the `verify` skill.
- Match the Ledger design system exactly — reuse the real CSS variables already defined in `src/app.css` (e.g. `--color-danger-bg`, `--color-border-strong`, `--ease-premium`). Do not invent new tokens.

---

### Task 1: Workers AI binding (wrangler.toml + Platform types)

**Files:**
- Modify: `wrangler.toml`
- Modify: `src/app.d.ts`

**Interfaces:**
- Produces: `platform.env.AI` (typed `Ai` from `@cloudflare/workers-types`), available to every server route from this task onward. Task 3 consumes this.

- [ ] **Step 1: Confirm the binding syntax with the wrangler skill**

  Invoke the `wrangler` skill and confirm the exact TOML syntax for a Workers AI binding (this project uses `wrangler.toml`, not `wrangler.jsonc`). The confirmed syntax is a single `[ai]` table (not an array-of-tables `[[ai]]`, since there is only ever one AI binding):

  ```toml
  [ai]
  binding = "AI"
  ```

- [ ] **Step 2: Add the binding to wrangler.toml**

  Current file:

  ```toml
  name = "booking-app"
  compatibility_date = "2024-09-23"
  compatibility_flags = ["nodejs_compat"]
  pages_build_output_dir = ".svelte-kit/cloudflare"

  [[d1_databases]]
  binding = "DB"
  database_name = "leads-db"
  database_id = "f435210f-6c93-468e-8802-6b8cc9f56f41"
  migrations_dir = "drizzle/migrations"

  [[r2_buckets]]
  bucket_name = "leads-diary-photos"
  binding = "DIARY_PHOTOS"
  ```

  Add the `[ai]` block after `[[r2_buckets]]`, so the full file reads:

  ```toml
  name = "booking-app"
  compatibility_date = "2024-09-23"
  compatibility_flags = ["nodejs_compat"]
  pages_build_output_dir = ".svelte-kit/cloudflare"

  [[d1_databases]]
  binding = "DB"
  database_name = "leads-db"
  database_id = "f435210f-6c93-468e-8802-6b8cc9f56f41"
  migrations_dir = "drizzle/migrations"

  [[r2_buckets]]
  bucket_name = "leads-diary-photos"
  binding = "DIARY_PHOTOS"

  [ai]
  binding = "AI"
  ```

- [ ] **Step 3: Add the `AI` binding to the `Platform.env` type**

  Open `src/app.d.ts` (current contents):

  ```ts
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
        context?: {
          waitUntil(promise: Promise<unknown>): void;
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

  Change the import line and the `env` block:

  ```ts
  import type { D1Database, R2Bucket, Ai } from '@cloudflare/workers-types';
  import type { Session, User } from 'better-auth';

  declare global {
    namespace App {
      interface Platform {
        env: {
          DB: D1Database;
          DIARY_PHOTOS: R2Bucket;
          AI: Ai;
          GEMINI_API_KEY: string;
          BETTER_AUTH_SECRET: string;
        };
        context?: {
          waitUntil(promise: Promise<unknown>): void;
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

- [ ] **Step 4: Type-check**

  Run: `npm run check`
  Expected: no new errors. (There is nothing yet that uses `platform.env.AI`, so this just confirms the type itself resolves — `Ai` is exported by `@cloudflare/workers-types`, already a devDependency.)

- [ ] **Step 5: Verify locally that the binding resolves**

  Run: `npm run cf:dev`
  Add a temporary `console.log(typeof platform?.env.AI)` is unnecessary — instead, confirm via Wrangler's own startup output that no "unknown binding" warning appears for `AI`, and that the dev server starts cleanly. Stop the dev server once confirmed (Ctrl+C).

- [ ] **Step 6: Commit**

  ```bash
  git add wrangler.toml src/app.d.ts
  git commit -m "feat: add Workers AI binding for voice transcription"
  ```

---

### Task 2: Gemini spoken-text extraction (`extractBookingsFromText`)

**Files:**
- Modify: `src/lib/server/gemini.ts`

**Interfaces:**
- Consumes: existing `BookingSchema` (Zod), `istAnchorDate()`, `withRetry()`, `isRetryable()` — all already defined in this file, all module-private, all reused as-is.
- Produces: `export async function extractBookingsFromText(transcript: string, apiKey: string): Promise<ExtractedBooking[]>` — same return type as the existing `extractBookings()`. Task 3 consumes this exact signature.

- [ ] **Step 1: Add the `TEXT_EXTRACTION_PROMPT` constant**

  Open `src/lib/server/gemini.ts`. Directly below the existing `PROMPT_TEMPLATE` constant (after the line `"event_slot": 0.80 }\n  }\n]\`;` and before the "Retry helper" section comment), add:

  ```ts
  // ──────────────────────────────────────────────────────────────────────────
  // Text prompt — for a spoken (Whisper-transcribed) booking list, not a photo
  // ──────────────────────────────────────────────────────────────────────────

  const TEXT_EXTRACTION_PROMPT = `# Task — Spoken Booking Extraction

  You read a transcript of an event organiser speaking out loud, dictating one or more bookings from her vendor diary, and extract every booking she mentions as structured data for her CRM.

  ## Reference Anchor Date

  Today's date (IST) is: {{ANCHOR_DATE}}

  Treat this value as "today" only for the narrow purpose of inferring a missing year or resolving a relative date phrase (e.g. "next Sunday", "this coming Diwali week"). It must never override an exact date she states explicitly.

  ## Input Characteristics

  The transcript comes from automatic speech recognition (Whisper) of natural, conversational Indian English mixed with Hindi/Telugu/Hinglish words and phrasing. Expect:
  - Casual, informal references to events: "marriage" or "shaadi" means Marriage, "reception" stays Reception, "birthday" or "bday party" means Birthday, "engagement" or "ring ceremony" means Engagement, "sangeet" stays Sangeet.
  - Casual references to time of day instead of explicit AM/PM: "morning", "subah", "10 baje" (10 o'clock, context decides AM/PM) map to AM; "evening", "shaam", "night", "raat" map to PM.
  - Phone numbers spoken as individual digits in sequence (e.g. "nine eight seven six five four three two one zero" or grouped "98765 43210") — assemble them into a single 10-digit number.
  - Names spoken with honorifics or community titles attached ("Anji Reddy garu", "Gopal Goud", "Mrs. Lakshmi") — strip respectful suffixes like "garu"/"ji"/"Mr."/"Mrs." the same way the photo pipeline does, keeping the core given name and any traditional caste/community title.
  - ASR transcription noise: misheard words, filler words ("um", "so", "okay then"), false starts, or a word repeated twice. Read through these for intent — don't transcribe filler as data.
  - Multiple bookings may be dictated back-to-back in one breath, sometimes separated only by a pause marked with a comma or "and then" in the transcript.

  ## Fields To Extract

  Return one object per booking with these keys:

  - customer_name — core given name and traditional caste/community title only, honorifics stripped (e.g. "Anji Reddy", not "Anji Reddy Garu").
  - event_type — one of: Marriage, Engagement, Reception, Sangeet, Birthday, Other. Map spoken synonyms as above. If genuinely unclear, use Other.
  - event_date — format YYYY-MM-DD. If she states a full date, use it exactly. If she gives a relative phrase ("next Friday", "first week of December"), resolve it relative to the Reference Anchor Date, choosing the next upcoming occurrence. If no date is mentioned at all for a booking, use an empty string and score its confidence low.
  - event_slot — "AM" or "PM", inferred from any spoken time-of-day cue (see Input Characteristics). If she gives an explicit clock time, map 5 AM–4 PM to AM and 5 PM–2 AM to PM. If no time-of-day cue is given at all, default to "AM" and score event_slot confidence below 0.5.
  - phone_primary — the main phone number, normalised to +91XXXXXXXXXX. Assemble sequentially spoken digits in the order spoken; keep the last 10 digits; strip a leading 0, 91, or +91. If you cannot recover exactly 10 digits, use an empty string and score its confidence low. Never guess missing digits.
  - phone_secondary — a second number in the same format if she mentions one (often introduced as "alternate number" or "another number"), otherwise null.
  - confidence — an object with numeric scores from 0 to 1 for customer_name, event_type, event_date, phone_primary, and event_slot.

  ## Extraction Rules

  - Extract every booking she dictates; do not stop after the first.
  - If she explicitly says to skip, cancel, or remove a booking she just mentioned, omit it.
  - Never merge two distinct bookings into one, and never split one booking into two, even if her phrasing runs them together.
  - Never fabricate a value. A field she didn't say is an empty string or null, with low confidence where a confidence score applies.
  - If the transcript contains no identifiable bookings at all (e.g. she was just testing the microphone), return an empty array.

  ## Confidence Scoring

  Score honestly. A value you reconstructed from ambiguous or noisy ASR output pulls the relevant score below 0.7. A value she stated clearly and unambiguously scores above 0.9. An event_slot defaulted to AM with no spoken cue should score below 0.5. A downstream confirm step relies on these scores to flag fields for human review, so accuracy here matters more than optimism.

  ## Example (illustrative shape only)

  [
    {
      "customer_name": "Ravi Kumar",
      "event_type": "Marriage",
      "event_date": "2026-11-23",
      "event_slot": "PM",
      "phone_primary": "+919876543210",
      "phone_secondary": null,
      "confidence": { "customer_name": 0.95, "event_type": 0.92, "event_date": 0.85, "phone_primary": 0.80, "event_slot": 0.88 }
    }
  ]`;
  ```

- [ ] **Step 2: Add `extractBookingsFromText()` below the existing `extractBookings()`**

  At the end of the file, after the closing brace of `extractBookings()` (the line `return z.array(BookingSchema).parse(parsed);\n}`), add:

  ```ts

  // ──────────────────────────────────────────────────────────────────────────
  // Text extraction — for a Whisper-transcribed spoken booking list
  // ──────────────────────────────────────────────────────────────────────────

  export async function extractBookingsFromText(
    transcript: string,
    apiKey: string
  ): Promise<ExtractedBooking[]> {
    const ai = new GoogleGenAI({ apiKey });
    const prompt =
      TEXT_EXTRACTION_PROMPT.replace('{{ANCHOR_DATE}}', istAnchorDate()) +
      '\n\n## Transcript To Parse\n\n"""\n' +
      transcript +
      '\n"""';

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        },
      })
    );

    const raw = response.text ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Gemini did not return valid JSON from the transcript. Ask the user to try again.');
    }

    return z.array(BookingSchema).parse(parsed);
  }
  ```

  Note: `BookingSchema` is reused unchanged — this function never defines a second schema, matching the spec's requirement.

- [ ] **Step 3: Type-check**

  Run: `npm run check`
  Expected: no errors. `extractBookingsFromText` should type-check against the same `ExtractedBooking` return type as `extractBookings`.

- [ ] **Step 4: Manually sanity-check the prompt against a sample transcript**

  This file has no existing test harness (see Global Constraints), so verify by hand: temporarily write a throwaway script (do not commit it) such as `scratchpad/try-extract.ts`:

  ```ts
  import { extractBookingsFromText } from '../src/lib/server/gemini';

  const sample =
    "Okay so first one, Ravi Kumar, marriage, twenty third November, evening, number is nine eight seven six five four three two one zero. Second one, Lakshmi garu, birthday party, morning, this Saturday, alternate number nine one two three four five six seven eight nine.";

  extractBookingsFromText(sample, process.env.GEMINI_API_KEY!)
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => console.error(e));
  ```

  Run it with your local `GEMINI_API_KEY` (from `.dev.vars`) set in the environment, e.g.:
  `GEMINI_API_KEY=<value-from-.dev.vars> npx tsx scratchpad/try-extract.ts`

  Expected: an array of 2 booking objects, with `event_type` "Marriage" and "Birthday", `event_slot` "PM" and "AM" respectively, and both phone numbers normalised to `+91XXXXXXXXXX`. Delete the throwaway script when done — it must not be committed.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/server/gemini.ts
  git commit -m "feat: extract bookings from spoken transcripts via Gemini text mode"
  ```

---

### Task 3: `/api/extract-voice` endpoint

**Files:**
- Create: `src/routes/api/extract-voice/+server.ts`

**Interfaces:**
- Consumes: `extractBookingsFromText(transcript: string, apiKey: string): Promise<ExtractedBooking[]>` (Task 2), `platform.env.AI` (Task 1), `normalisePhone` from `$lib/utils`, `cleanupStaleLeads` from `$lib/server/cleanup`, `leads` table from `$lib/server/db/schema`.
- Produces: `POST /api/extract-voice` accepting `multipart/form-data` with fields `audio: File` and `venue_id: string`. Returns `{ session_id: string, count: number }` on success — the same response shape as `/api/extract`. Task 4 (frontend) consumes this exact contract.

- [ ] **Step 1: Confirm the Whisper call signature with the cloudflare skill**

  Invoke the `cloudflare` skill (Workers AI reference) and confirm the exact input/output shape for `@cf/openai/whisper-large-v3-turbo` via `env.AI.run(...)`. Confirmed contract:
  - Input: `{ audio: string }` where the string is **base64-encoded** raw audio bytes (not a raw `ArrayBuffer`/`Uint8Array`, and not wrapped as `{ audio: number[] }`). An optional `language` field can pin the spoken language, but it is deliberately omitted here so the model auto-detects across the mixed English/Hindi/Telugu/Hinglish speech this app expects.
  - Output: an object with a top-level `text: string` field containing the full transcription (also `word_count`, `segments`, `vtt`, `transcription_info`, none of which this endpoint needs).

- [ ] **Step 2: Write the endpoint**

  Create `src/routes/api/extract-voice/+server.ts`:

  ```ts
  import { json, error } from '@sveltejs/kit';
  import { extractBookingsFromText } from '$lib/server/gemini';
  import { createDb } from '$lib/server/db';
  import { leads } from '$lib/server/db/schema';
  import { normalisePhone } from '$lib/utils';
  import { cleanupStaleLeads } from '$lib/server/cleanup';
  import type { RequestHandler } from './$types';

  export const POST: RequestHandler = async ({ request, platform, locals }) => {
    if (!locals.user) throw error(401, 'Unauthorized');

    const env = platform!.env;
    const form = await request.formData();
    const file = form.get('audio');
    const venueId = form.get('venue_id');

    if (!(file instanceof File) || typeof venueId !== 'string') {
      throw error(400, 'Missing audio or venue_id');
    }

    // Guard before paying for Whisper + Gemini. A held-button recording is at
    // most a few minutes of compressed speech; 15 MB is a generous ceiling.
    const MAX_BYTES = 15 * 1024 * 1024;
    if (file.type && !file.type.startsWith('audio/')) {
      throw error(415, 'Please send an audio recording.');
    }
    if (file.size > MAX_BYTES) {
      throw error(413, 'Recording is too long (max 15 MB).');
    }

    const buffer = await file.arrayBuffer();
    const mimeType = file.type || 'audio/webm';
    const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
    // Suffix a random token, same collision-avoidance pattern as /api/extract.
    const audioKey = `voice-recordings/${venueId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    // Each recording is its own session — unlike the photo batch, a voice note
    // isn't part of a multi-file upload sharing one session_id.
    const sessionId = crypto.randomUUID();

    const db = createDb(env.DB);
    platform!.context?.waitUntil?.(cleanupStaleLeads(db, env.DIARY_PHOTOS).catch(() => {}));

    // 1. store the raw recording in R2 immediately, for compliance/audit. This
    //    key is intentionally never written to the `leads` table — see the
    //    plan's "sourceImageKey" decision. It is therefore outside
    //    cleanupStaleLeads's orphan sweep; that's accepted, not a bug.
    await env.DIARY_PHOTOS.put(audioKey, buffer, {
      httpMetadata: { contentType: mimeType }
    });

    // 2. transcribe with Workers AI Whisper
    let transcript: string;
    try {
      const base64 = Buffer.from(buffer).toString('base64');
      const result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: base64 });
      transcript = (result as { text?: string }).text?.trim() ?? '';
    } catch (e) {
      throw error(502, e instanceof Error ? e.message : 'Transcription failed');
    }

    if (!transcript) {
      return json({ session_id: sessionId, count: 0 });
    }

    // 3. extract structured bookings from the transcript with Gemini (throws on
    //    invalid JSON -> 422 with a clear message, same as /api/extract)
    let extracted;
    try {
      extracted = await extractBookingsFromText(transcript, env.GEMINI_API_KEY);
    } catch (e) {
      throw error(422, e instanceof Error ? e.message : 'Extraction failed');
    }

    if (extracted.length === 0) {
      return json({ session_id: sessionId, count: 0 });
    }

    // 4. insert as unconfirmed leads — identical shape to /api/extract, except
    //    sourceImageKey is null (voice leads have no photo; confirm screen
    //    already skips the photo rail when every lead's key is null/falsy).
    await db.insert(leads).values(
      extracted.map((b) => {
        const primary = normalisePhone(b.phone_primary);
        const secondary = b.phone_secondary ? normalisePhone(b.phone_secondary) : '';
        const confidence = {
          customer_name: b.confidence.customer_name,
          event_type: b.confidence.event_type,
          event_date: b.confidence.event_date,
          event_slot: b.confidence.event_slot,
          phone_primary: primary ? b.confidence.phone_primary : Math.min(b.confidence.phone_primary, 0.3),
          phone_secondary: !b.phone_secondary ? 1 : secondary ? 0.9 : 0.3
        };

        return {
          sessionId,
          venueId,
          customerName: b.customer_name,
          eventType: b.event_type,
          eventDate: b.event_date,
          eventSlot: b.event_slot,
          phonePrimary: primary || b.phone_primary,
          phoneSecondary: b.phone_secondary ? secondary || b.phone_secondary : null,
          sourceImageKey: null,
          extractionConfidence: JSON.stringify(confidence),
          isConfirmed: false
        };
      })
    );

    return json({ session_id: sessionId, count: extracted.length });
  };
  ```

- [ ] **Step 3: Type-check**

  Run: `npm run check`
  Expected: no errors. If `platform.env.AI` doesn't resolve, re-check Task 1, Step 3 was committed.

- [ ] **Step 4: Review the endpoint against best practices**

  Invoke the `workers-best-practices` skill and review this file specifically for: binding usage (`env.AI`, `env.DIARY_PHOTOS`, `env.DB` all created/used per-request, never module-scoped — already true here), the `waitUntil` usage for the cleanup sweep (matches the existing `/api/extract` pattern exactly), and error handling (every external call — R2 put, AI run, Gemini extraction — is either unguarded-but-safe or wrapped with a clear user-facing `error()` thrown). Fix anything the skill flags before moving on.

- [ ] **Step 5: Manually verify the endpoint with curl**

  Start the real Cloudflare Pages dev server (D1/R2/AI are only bound here, not under `npm run dev`):

  Run: `npm run cf:dev`

  In a second terminal, record a short test clip (or use any existing `.webm`/`.ogg`/`.wav` file with someone speaking a booking) and post it. You'll need a logged-in session cookie — log in via the browser first at `http://localhost:8788/login`, then copy the `better-auth.session_token` cookie value, or simply drive this step from the browser's dev tools `fetch()` console while logged in:

  ```js
  const fd = new FormData();
  fd.append('audio', /* a File/Blob you recorded via the mic, or an uploaded test file */ myAudioBlob, 'test.webm');
  fd.append('venue_id', /* a real venue id from your dev DB */ 'YOUR_VENUE_ID');
  const res = await fetch('/api/extract-voice', { method: 'POST', body: fd });
  console.log(res.status, await res.json());
  ```

  Expected: HTTP 200 with `{ session_id: "<uuid>", count: <n> }` where `count` matches the number of bookings you spoke. Then run:

  Run: `wrangler d1 execute leads-db --local --command "SELECT customer_name, event_type, event_date, event_slot, phone_primary, source_image_key FROM leads ORDER BY created_at DESC LIMIT 5"`

  Expected: your spoken booking(s), with `source_image_key` showing `NULL`.

- [ ] **Step 6: Commit**

  ```bash
  git add src/routes/api/extract-voice/+server.ts
  git commit -m "feat: add /api/extract-voice endpoint (Whisper + Gemini text extraction)"
  ```

---

### Task 4: Frontend "Record Voice" UI

**Files:**
- Modify: `src/routes/upload/+page.svelte`

**Interfaces:**
- Consumes: `POST /api/extract-voice` returning `{ session_id: string, count: number, message?: string }` (Task 3) — note `message` is the field the server sends on `error(status, message)`, mirrored from the existing `ExtractResponse` type already declared in this file.
- Produces: nothing consumed elsewhere — this is the leaf UI entry point. On success it calls the existing `goto(\`/confirm?session=${session_id}\`)` navigation, exactly like the photo-batch flow already does.

- [ ] **Step 1: Confirm the visual direction with the frontend-design skill**

  Invoke the `frontend-design` skill before writing markup/CSS. Brief: a press-and-hold "Record Voice" button living in the `margin-rail` of `upload/+page.svelte`, alongside the existing venue picker and read-mode toggle. It must reuse the Ledger system's existing tokens (`--color-bg-elevated`, `--color-border-strong`, `--ease-premium`, `--color-danger-bg`/`--color-danger-text` for the active-recording state — danger tokens are the natural fit for a "recording" affordance, not a new hue) rather than introducing new colors. The recording-state waveform should be a simple set of CSS-animated bars (matching the restraint already shown by `.thumb-scan`'s sweep animation elsewhere in this same file) — not a full Web Audio API frequency analyser, which would be speculative complexity for a "is it recording" signal. Use the design produced below as the starting point and adjust only if the skill flags a concrete mismatch with `docs/design-system.md`.

- [ ] **Step 2: Add voice-recording state and logic to the script block**

  Open `src/routes/upload/+page.svelte`. Directly after the closing brace of the existing `readPages()` function (the line `}` right before `</script>`), add:

  ```ts

  // ── Voice capture ──────────────────────────────────────────────────────
  type VoiceStatus = 'idle' | 'recording' | 'uploading' | 'error';
  let voiceStatus = $state<VoiceStatus>('idle');
  let voiceError = $state('');
  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let audioChunks: Blob[] = [];

  // getUserMedia requires a secure context (HTTPS or localhost). Checked lazily
  // inside startRecording (not at module scope) so this file still SSRs fine —
  // MediaRecorder/navigator.mediaDevices don't exist on the server.
  function pickRecorderMime(): string {
    if (typeof MediaRecorder === 'undefined') return 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
    return 'audio/webm';
  }

  async function startRecording() {
    if (voiceStatus !== 'idle' || !venueId) return;
    voiceError = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      voiceStatus = 'error';
      voiceError = 'Voice recording needs a secure connection (HTTPS) or localhost.';
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      voiceStatus = 'error';
      voiceError =
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Microphone access was denied. Allow it in your browser settings, then try again.'
          : "Couldn't access the microphone. Please try again.";
      return;
    }

    const mimeType = pickRecorderMime();
    audioChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      mediaStream?.getTracks().forEach((t) => t.stop());
      mediaStream = null;
      void uploadRecording(mimeType);
    };
    mediaRecorder.start();
    voiceStatus = 'recording';
  }

  function stopRecording() {
    if (voiceStatus !== 'recording' || !mediaRecorder) return;
    mediaRecorder.stop();
  }

  async function uploadRecording(mimeType: string) {
    if (audioChunks.length === 0) {
      voiceStatus = 'idle';
      return;
    }
    voiceStatus = 'uploading';
    const blob = new Blob(audioChunks, { type: mimeType });
    audioChunks = [];

    try {
      const fd = new FormData();
      const extension = mimeType.includes('ogg') ? 'ogg' : 'webm';
      fd.append('audio', blob, `recording.${extension}`);
      fd.append('venue_id', venueId);
      const res = await fetch('/api/extract-voice', { method: 'POST', body: fd });
      const body = (await res.json().catch(() => ({}))) as ExtractResponse;
      if (!res.ok) {
        throw new Error(body?.message || `Couldn't transcribe the recording (error ${res.status}).`);
      }
      if (!body.session_id || !body.count) {
        voiceStatus = 'error';
        voiceError = "Didn't catch any bookings in that recording — try again.";
        return;
      }
      voiceStatus = 'idle';
      await goto(`/confirm?session=${body.session_id}`);
    } catch (e) {
      voiceStatus = 'error';
      voiceError = e instanceof Error ? e.message : 'Something went wrong uploading the recording.';
    }
  }
  ```

  This reuses the `ExtractResponse` type and `venueId`/`goto` already declared earlier in this same file — no new imports needed.

- [ ] **Step 3: Add the Record Voice section to the margin rail**

  In the markup, directly after the closing `</section>` of the existing `venue-section` block (right before the `{#if pages.length > 0}` read-mode section), add:

  ```svelte

    <section class="voice-section">
      <span class="field-label" id="voice-label">Or speak the bookings</span>
      <button
        type="button"
        class="voice-btn"
        class:recording={voiceStatus === 'recording'}
        disabled={!venueId || voiceStatus === 'uploading'}
        onpointerdown={startRecording}
        onpointerup={stopRecording}
        onpointerleave={stopRecording}
        onpointercancel={stopRecording}
        aria-pressed={voiceStatus === 'recording'}
        aria-labelledby="voice-label"
      >
        {#if voiceStatus === 'recording'}
          <span class="voice-wave" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span>
          </span>
          <span>Recording… release to send</span>
        {:else if voiceStatus === 'uploading'}
          <span>Transcribing…</span>
        {:else}
          <svg class="voice-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
          <span>Hold to record</span>
        {/if}
      </button>
      <p class="voice-hint">Press and hold, speak the bookings, release to send.</p>
      {#if voiceStatus === 'error' && voiceError}
        <p class="voice-error" role="alert">{voiceError}</p>
      {/if}
    </section>
  ```

- [ ] **Step 4: Add the voice button styles**

  In the `<style>` block, directly after the closing `}` of `.add-error` (end of the `venue-section`'s styles, right before the `/* ── Read-mode toggle */` comment), add:

  ```css
    /* ── Voice capture — press-and-hold record button ──────────────────────── */
    .voice-section {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
    }
    .voice-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-1);
      width: 100%;
      min-height: 56px;
      padding-inline: var(--spacing-2);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background-color: var(--color-bg-elevated);
      color: var(--color-text-primary);
      font-size: var(--text-sm);
      font-weight: 600;
      cursor: pointer;
      touch-action: none;
      user-select: none;
      transition:
        background-color var(--duration-base) var(--ease-premium),
        border-color var(--duration-base) var(--ease-premium),
        color var(--duration-base) var(--ease-premium);
    }
    .voice-btn:hover:not(:disabled):not(.recording) {
      border-color: var(--color-accent);
    }
    .voice-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .voice-btn.recording {
      background-color: var(--color-danger-bg);
      border-color: var(--color-danger-text);
      color: var(--color-danger-text);
    }
    .voice-icon {
      width: 1.25rem;
      height: 1.25rem;
    }
    .voice-wave {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      height: 18px;
    }
    .voice-wave span {
      display: block;
      width: 3px;
      height: 100%;
      background-color: currentColor;
      border-radius: var(--radius-full);
      animation: wave-pulse 0.9s var(--ease-standard) infinite;
    }
    .voice-wave span:nth-child(1) { animation-delay: 0ms; }
    .voice-wave span:nth-child(2) { animation-delay: 100ms; }
    .voice-wave span:nth-child(3) { animation-delay: 200ms; }
    .voice-wave span:nth-child(4) { animation-delay: 300ms; }
    .voice-wave span:nth-child(5) { animation-delay: 400ms; }
    .voice-hint {
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
      color: var(--color-text-tertiary);
    }
    .voice-error {
      font-size: var(--text-sm);
      color: var(--color-danger-text);
      background-color: var(--color-danger-bg);
      padding: var(--spacing-1) var(--spacing-2);
      border-radius: var(--radius-md);
    }
  ```

  And add the keyframe + reduced-motion override at the end of the existing `@keyframes`/`@media (prefers-reduced-motion: reduce)` area (directly inside the existing `@media (prefers-reduced-motion: reduce) { .thumb-scan { ... } }` block, add a sibling rule, and add the new `@keyframes` block right after the `.thumb-scan` keyframes-using rule):

  ```css
    @keyframes wave-pulse {
      0%, 100% { transform: scaleY(0.3); }
      50% { transform: scaleY(1); }
    }
  ```

  ```css
    @media (prefers-reduced-motion: reduce) {
      .thumb-scan {
        animation: none;
        top: 50%;
      }
      .voice-wave span {
        animation: none;
        transform: scaleY(0.7);
      }
    }
  ```

  (Merge this into the existing `@media (prefers-reduced-motion: reduce)` block rather than duplicating it — there is already exactly one such block in this file.)

- [ ] **Step 5: Type-check**

  Run: `npm run check`
  Expected: no errors.

- [ ] **Step 6: Manually verify in the browser**

  Run: `npm run cf:dev`, open `http://localhost:8788/upload` (or whatever port Wrangler reports), log in if needed, select a venue.

  - Press and hold "Hold to record" → confirm the browser's mic-permission prompt appears (first time), and the button switches to the red "Recording… release to send" state with the animated bars.
  - Release → button shows "Transcribing…" briefly, then the page navigates to `/confirm?session=...` showing the booking(s) you spoke, with no photo rail.
  - Deny the mic permission once (browser site settings → block mic, reload) and press the button again → confirm the inline red error message appears instead of a silent failure.

- [ ] **Step 7: Commit**

  ```bash
  git add src/routes/upload/+page.svelte
  git commit -m "feat: add press-and-hold voice recorder to the upload screen"
  ```

---

### Task 5: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full type-check**

  Run: `npm run check`
  Expected: zero errors across the whole project.

- [ ] **Step 2: Drive the real flow with the verify skill**

  Invoke the `verify` skill to actually exercise the feature, not just type-check it. Confirm, in a real browser against `npm run cf:dev`:
  1. Record → release → the recording reaches `/api/extract-voice` (watch the network tab; expect a 200 with `{ session_id, count }`).
  2. Transcription happens (Whisper) and extraction happens (Gemini) without manual intervention — the response `count` reflects what was actually spoken.
  3. The confirm screen at `/confirm?session=<id>` shows the correct booking(s): right name, event type, date, AM/PM slot, and phone number(s) — with any field Gemini scored below 0.75 confidence showing the existing amber "Double-check" chip (this proves the new code is correctly reusing the existing confidence-flagging logic, not bypassing it).
  4. No photo rail renders on a voice-only session (confirms the `sourceImageKey: null` decision degrades cleanly).
  5. Saving the confirm screen's bookings (the existing, unmodified `?/save` action) writes them as confirmed leads — check `/leads` afterward.
  6. The permission-denied path shows the inline message, not a silent failure or a thrown unhandled exception in the console.

  Fix anything that doesn't behave as above before considering this feature done — a passing `npm run check` does not prove the pipeline works, only that it compiles.

- [ ] **Step 3: Confirm no regressions in the existing photo pipeline**

  In the same browser session, run through the existing photo upload → confirm flow once (`/upload`, add a diary photo, read it, confirm it) to confirm the new voice UI sharing the same `venueId` state and margin rail hasn't broken the existing flow.

---

## Self-Review Notes

- **Spec coverage:** Step 0 (wrangler binding) → Task 1. Step 1 (frontend recorder UI, premium button, waveform, permission handling) → Task 4. Step 2 (backend Whisper + R2 endpoint) → Task 3. Step 3 (Gemini spoken-text layer reusing `BookingSchema`) → Task 2. Step 4 (DB insert pattern + the `sourceImageKey`/`sourceAudioKey` decision, explicitly made as (b)) → decision section above + Task 3, Step 2. Step 5 (svelte-check + verify skill driving the real flow) → Task 5.
- **No placeholders:** every step above contains complete, copy-paste-ready code — no "add error handling" or "similar to Task N" shorthand.
- **Type consistency:** `extractBookingsFromText(transcript: string, apiKey: string): Promise<ExtractedBooking[]>` (Task 2) is called identically in Task 3 (`extractBookingsFromText(transcript, env.GEMINI_API_KEY)`). The `{ session_id, count }` response shape produced in Task 3 matches the `ExtractResponse` type already declared and reused in Task 4's frontend code.
