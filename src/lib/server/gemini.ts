// src/lib/gemini.ts
import { GoogleGenAI, ThinkingLevel, MediaResolution } from '@google/genai';
import { z } from 'zod';

// ──────────────────────────────────────────────────────────────────────────
// Schema (Zod) — also the contract validated after every extraction
// ──────────────────────────────────────────────────────────────────────────

const EVENT_TYPES = ['Marriage', 'Engagement', 'Reception', 'Sangeet', 'Birthday', 'Other'] as const;

const BookingSchema = z.object({
  customer_name:   z.string(),
  event_type:      z.enum(EVENT_TYPES),
  event_date:      z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/), // YYYY-MM-DD or "" if illegible
  event_slot:      z.enum(['AM', 'PM']),
  phone_primary:   z.string(),
  phone_secondary: z.string().nullable(),
  confidence: z.object({
    customer_name: z.number().min(0).max(1),
    event_type:    z.number().min(0).max(1),
    event_date:    z.number().min(0).max(1),
    phone_primary: z.number().min(0).max(1),
    event_slot:    z.number().min(0).max(1),
  }),
});

export type ExtractedBooking = z.infer<typeof BookingSchema>;

// ──────────────────────────────────────────────────────────────────────────
// Anchor date — IST calendar date (YYYY-MM-DD), string-replaced at runtime
// ──────────────────────────────────────────────────────────────────────────

function istAnchorDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// ──────────────────────────────────────────────────────────────────────────
// Prompt — keep verbatim; {{ANCHOR_DATE}} is replaced per request
// ──────────────────────────────────────────────────────────────────────────

const PROMPT_TEMPLATE = `# Task — Vendor Diary Booking Extraction

You read a photograph of one page from an event vendor's physical booking diary and extract every booking on it as structured data for an event organiser's CRM.

## Reference Anchor Date

Today's date (IST) is: {{ANCHOR_DATE}}

Treat this value as "today" only for the narrow purpose of inferring a missing year when no year is written on the page. It must never override a year that is actually printed or written in the diary.

## Input Characteristics

The page has PRINTED date headers or slot labels, with bookings HANDWRITTEN beneath them. Handwriting is often messy or cursive and may mix English, Hindi, Telugu, and Hinglish — read all of them. A single page usually contains several bookings. Reason carefully through each entry before assigning its fields.

## Fields To Extract

Return one object per booking with these keys:

- customer_name — Extract only the core first/given name and their traditional caste/community title if present (e.g., "Anji Reddy", "Gopal Goud"). Completely strip out any respectful honorific suffixes like "Garu", or standalone middle initials (e.g., transform "P. Anji Reddy Garu" to just "Anji Reddy").
- event_type — one of: Marriage, Engagement, Reception, Sangeet, Birthday, Other. Map synonyms (e.g. "wedding" maps to Marriage, "bday" maps to Birthday). If genuinely unclear, use Other.
- event_date — format YYYY-MM-DD. Read the date from the PRINTED slot the entry sits under, and transcribe exactly what is written, including the year. If a full year is printed or written (e.g. "2-2-2025"), you MUST use that exact year even if the resulting date is in the past — never shift, correct, or roll a written year forward. Only when NO year is written at all (e.g. just "2 Feb") may you infer the year, choosing the next upcoming occurrence relative to the Reference Anchor Date above. If the date is fully illegible, use an empty string and score its confidence low.
- event_slot — "AM" or "PM" (see Event Slot rules below).
- phone_primary — the main phone number, normalised to +91XXXXXXXXXX. Keep the last 10 digits; drop a leading 0, 91, or +91; strip spaces, dashes, and brackets. If you cannot recover 10 clean digits, use an empty string and score its confidence low. Never guess missing digits.
- phone_secondary — a second number in the same format if present, otherwise null. Two numbers may be separated by "/", ",", or "alt".
- confidence — an object with numeric scores from 0 to 1 for customer_name, event_type, event_date, phone_primary, and event_slot.

## Event Slot (AM or PM)

Convention halls rent only two slots: morning (AM, 5 AM–4 PM) and evening (PM, 5 PM–2 AM). Every booking is exactly one of these. Determine event_slot as follows:

1. Position is the primary signal. The diary page is split horizontally: entries in the TOP half of the page are morning (AM); entries in the BOTTOM half are evening (PM).
2. If an explicit time is written for an entry, map it to its slot (5 AM–4 PM is AM, 5 PM–2 AM is PM). If a written time conflicts with the entry's position, prefer the written time and lower the event_slot confidence.
3. For entries near the vertical middle of the page where the half is ambiguous, score event_slot confidence below 0.7.

## Extraction Rules

- Extract every legible booking on the page; do not stop after the first.
- Skip any entry that is struck through, crossed out, or marked cancelled, cancel, or rejected.
- Never merge two bookings into one, and never split one booking into two.
- Never fabricate a value. A missing field is an empty string or null, with low confidence where a confidence score applies.
- If the page contains no bookings, return an empty array.

## Confidence Scoring

Score honestly. A digit or letter you are inferring or guessing pulls the relevant score below 0.7. Clear, unambiguous handwriting scores above 0.9. An event_slot inferred only from page position (with no written time) should rarely score above 0.85. A downstream confirm step relies on these scores to flag fields for human review, so accuracy here matters more than optimism.

## Example (illustrative shape only)

[
  {
    "customer_name": "Ravi Kumar",
    "event_type": "Marriage",
    "event_date": "2026-11-23",
    "event_slot": "AM",
    "phone_primary": "+919876543210",
    "phone_secondary": null,
    "confidence": { "customer_name": 0.96, "event_type": 0.90, "event_date": 0.92, "phone_primary": 0.74, "event_slot": 0.80 }
  }
]`;

// ──────────────────────────────────────────────────────────────────────────
// Retry helper — backs off on rate-limit / transient errors (429 / 503)
// ──────────────────────────────────────────────────────────────────────────

function isRetryable(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('rate') ||
    msg.includes('quota') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable')
  );
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !isRetryable(err)) break;
      // exponential backoff: ~1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

// ──────────────────────────────────────────────────────────────────────────
// Main extraction
// ──────────────────────────────────────────────────────────────────────────

export async function extractBookings(
  imageBuffer: ArrayBuffer,
  apiKey: string,
  mimeType = 'image/jpeg'
): Promise<ExtractedBooking[]> {
  const ai = new GoogleGenAI({ apiKey });
  const base64 = Buffer.from(imageBuffer).toString('base64');
  const prompt = PROMPT_TEMPLATE.replace('{{ANCHOR_DATE}}', istAnchorDate());

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json', // native JSON enforcement
        temperature: 0.2,                      // not 0 — avoids degeneration on 3.x thinking models
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM }, // helps the AM/PM positional reasoning; drop to LOW to cut latency
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,  // better legibility + full-page layout for slot inference
      },
    })
  );

  const raw = response.text ?? '';

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Gemini did not return valid JSON. Ask the user to retake the photo.');
  }

  return z.array(BookingSchema).parse(parsed);
}