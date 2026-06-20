# Gemini extraction prompt (optimised)

This is the production prompt for reading a vendor's diary-page photo and returning structured booking data. Send it as the text part alongside the image part in a single `generateContent` call, with `responseMimeType: 'application/json'`.

Model: `gemini-2.5-flash`. Temperature: `0` (deterministic extraction — set in config if exposed).

---

## The prompt (use verbatim)

```
You read a photograph of a single page from an event vendor's physical booking diary and return the bookings on it as structured JSON.

The page has PRINTED date headers or slot labels. The bookings are HANDWRITTEN underneath them. Handwriting may mix English, Hindi, Telugu, and Hinglish — read all of them. One page usually holds several bookings.

## What to extract
Return a JSON array. One object per booking. Each object has exactly these keys:

- "customer_name": string. The customer's name as written.
- "event_type": one of "Marriage", "Engagement", "Reception", "Sangeet", "Birthday", "Other". Map synonyms (e.g. "wedding" → "Marriage", "bday" → "Birthday"). If genuinely unclear, use "Other".
- "event_date": string, "YYYY-MM-DD". Take the date from the PRINTED slot the entry sits under. If only day+month are visible, choose the year that makes the date the NEXT upcoming occurrence (never a past date relative to today). If the date is fully illegible, use "" and set its confidence low.
- "event_time": string, exactly as written (e.g. "7:30 PM", "morning", "evening", "11 am"). Use "" if absent.
- "phone_primary": string, normalised to "+91XXXXXXXXXX". Rules: keep the last 10 digits; drop a leading 0 or 91 or +91; strip spaces, dashes, brackets. If you cannot recover 10 clean digits, use "" and set confidence low — do NOT invent digits.
- "phone_secondary": string in the same format, or null. Diary entries sometimes list two numbers separated by "/", ",", or "alt".
- "confidence": object with numeric 0–1 scores for EVERY field: "customer_name", "event_type", "event_date", "event_time", "phone_primary", "phone_secondary". Score honestly. Any digit or letter you are guessing pulls the score below 0.7. Clear, unambiguous handwriting scores above 0.9. For a field that is legitimately absent (e.g. no second number, no time written), score 1.0 — you are confident it is empty.

## Rules
- Extract EVERY legible booking. Do not stop at the first.
- SKIP entries that are struck through, crossed out, or marked "cancelled"/"cancel"/"rejected".
- Never merge two bookings into one, and never split one booking into two.
- Never fabricate a field. Missing → "" or null, with low confidence where a confidence score applies.
- If the page contains no bookings (blank page, unrelated photo), return [].
- Output ONLY the JSON array. No markdown fences, no comments, no trailing text.

## Example output
[
  {
    "customer_name": "Ravi Kumar",
    "event_type": "Marriage",
    "event_date": "2026-11-23",
    "event_time": "7:00 PM",
    "phone_primary": "+919876543210",
    "phone_secondary": "+918765432109",
    "confidence": { "customer_name": 0.96, "event_type": 0.9, "event_date": 0.92, "event_time": 0.88, "phone_primary": 0.74, "phone_secondary": 0.7 }
  }
]
```

---

## Why it's built this way

- **Explicit schema + "exactly these keys"** keeps the output stable so your Zod parse never drifts.
- **Date inference rule** handles the common case where the diary slot shows only day/month — it resolves to the next future date instead of guessing a wrong year. The model has no clock, so `extractBookings` appends today's IST date to the prompt at call time to anchor "next upcoming occurrence".
- **Phone normalisation rules** cover the real variants you'll see in India: leading `0`, `91`, `+91`, spaces, two numbers in one cell.
- **"Never fabricate" + honest confidence** is the safety mechanism. The confirm screen keys off `confidence < 0.75` to flag fields, so the model must be willing to say "I'm unsure" rather than inventing a plausible phone number.
- **Skip cancelled entries** stops struck-through bookings from polluting the call list.
- **Return []** prevents a crash when she accidentally uploads a non-diary photo.

## Validation (already in `$lib/gemini.ts`)

After the call, strip any stray ```` ```json ```` fences, `JSON.parse`, then validate with the Zod schema. If validation throws, return a clean error so the UI can ask her to retake the photo — never save unvalidated data.

## Tuning later

If accuracy on real photos is off, in order of impact:
1. Add 1–2 *few-shot image+JSON pairs* from her actual vendors' diaries (most effective).
2. Lower temperature to 0 if not already.
3. If a specific vendor's layout confuses it, add a one-line hint to the prompt for that layout (passed per-vendor).
4. Only if Flash plateaus on bad handwriting, try `gemini-2.5-pro` for that fallback — slower and pricier, so route to it only on low-confidence pages.