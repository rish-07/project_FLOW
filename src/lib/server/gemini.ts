import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { todayISO } from '$lib/utils';

const EVENT_TYPES = ['Marriage', 'Engagement', 'Reception', 'Sangeet', 'Birthday', 'Other'] as const;

const LeadSchema = z.object({
  customer_name: z.string(),
  event_type: z.enum(EVENT_TYPES),
  event_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  event_time: z.string(),
  phone_primary: z.string(),
  phone_secondary: z.string().nullable(),
  confidence: z.object({
    customer_name: z.number().min(0).max(1),
    event_type: z.number().min(0).max(1),
    event_date: z.number().min(0).max(1),
    event_time: z.number().min(0).max(1),
    phone_primary: z.number().min(0).max(1),
    phone_secondary: z.number().min(0).max(1)
  })
});

export type ExtractedLead = z.infer<typeof LeadSchema>;

// Keep this prompt verbatim. See gemini-extraction-prompt.md for the rationale.
const PROMPT = `You read a photograph of a single page from an event vendor's physical booking diary and return the bookings on it as structured JSON.

The page has PRINTED date headers or slot labels. The bookings are HANDWRITTEN underneath them. Handwriting may mix English, Hindi, Telugu, and Hinglish — read all of them. One page usually holds several bookings.

## What to extract
Return a JSON array. One object per booking. Each object has exactly these keys:

- "customer_name": string. The customer's name as written.
- "event_type": one of "Marriage", "Engagement", "Reception", "Sangeet", "Birthday", "Other". Map synonyms (e.g. "wedding" -> "Marriage", "bday" -> "Birthday"). If genuinely unclear, use "Other".
- "event_date": string, "YYYY-MM-DD". Take the date from the PRINTED slot the entry sits under. If only day+month are visible, choose the year that makes the date the NEXT upcoming occurrence (never a past date relative to today). If the date is fully illegible, use "" and set its confidence low.
- "event_time": string, exactly as written (e.g. "7:30 PM", "morning", "evening", "11 am"). Use "" if absent.
- "phone_primary": string, normalised to "+91XXXXXXXXXX". Rules: keep the last 10 digits; drop a leading 0 or 91 or +91; strip spaces, dashes, brackets. If you cannot recover 10 clean digits, use "" and set confidence low — do NOT invent digits.
- "phone_secondary": string in the same format, or null. Diary entries sometimes list two numbers separated by "/", ",", or "alt".
- "confidence": object with numeric 0-1 scores for EVERY field: "customer_name", "event_type", "event_date", "event_time", "phone_primary", "phone_secondary". Score honestly. Any digit or letter you are guessing pulls the score below 0.7. Clear, unambiguous handwriting scores above 0.9. For a field that is legitimately absent (e.g. no second number, no time written), score 1.0 — you are confident it is empty.

## Rules
- Extract EVERY legible booking. Do not stop at the first.
- SKIP entries that are struck through, crossed out, or marked "cancelled"/"cancel"/"rejected".
- Never merge two bookings into one, and never split one booking into two.
- Never fabricate a field. Missing -> "" or null, with low confidence where a confidence score applies.
- If the page contains no bookings (blank page, unrelated photo), return [].
- Output ONLY the JSON array. No markdown fences, no comments, no trailing text.`;

export async function extractBookings(
  imageBuffer: ArrayBuffer,
  apiKey: string,
  mimeType = 'image/jpeg'
): Promise<ExtractedLead[]> {
  const ai = new GoogleGenAI({ apiKey });
  const base64 = Buffer.from(imageBuffer).toString('base64');

  // The model has no reliable clock, so the prompt's "next upcoming date" rule
  // needs an anchor. Inject today's IST date at call time.
  const datedPrompt = `${PROMPT}\n\nToday's date is ${todayISO()} (IST). When a diary entry shows only day and month, pick the year that makes the date the next upcoming occurrence relative to this date.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: datedPrompt }
        ]
      }
    ],
    config: { responseMimeType: 'application/json', temperature: 0 }
  });

  const raw = response.text ?? '';
  const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Gemini did not return valid JSON. Ask the user to retake the photo.');
  }

  return z.array(LeadSchema).parse(parsed);
}
