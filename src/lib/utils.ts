// Phone + date helpers shared across screens.

/** Normalise an Indian phone number to +91XXXXXXXXXX, or '' if not recoverable. */
export function normalisePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  const ten = digits.slice(-10);
  return ten.length === 10 ? `+91${ten}` : '';
}

/** True when `raw` yields a clean 10-digit Indian mobile (i.e. normalises). */
export function isValidPhone(raw: string | null | undefined): boolean {
  return normalisePhone(raw) !== '';
}

/** wa.me deep link uses no '+' prefix. */
export function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

export function telLink(phone: string): string {
  return `tel:${phone}`;
}

/**  "2026-04-20" -> "20 Apr 2026". */
export function humanDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** 'YYYY-MM-DD' + 'AM'|'PM' -> '20 Apr 2026 · AM'. Slot omitted if empty. */
export function formatDateSlot(iso: string, slot: string): string {
  const d = humanDate(iso);
  return slot ? `${d} · ${slot}` : d;
}

/**
 * Today's date as 'YYYY-MM-DD' in IST — the app's only timezone.
 * IST is a fixed UTC+5:30 with no DST, so shifting the epoch by 5.5h and reading
 * the UTC calendar date gives the correct Indian wall-clock date. Using plain
 * UTC here would roll the date over ~5.5h early every evening (IST).
 */
export function todayISO(): string {
  const istMs = Date.now() + 5.5 * 60 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

export type Confidence = {
  customer_name: number;
  event_type: number;
  event_date: number;
  event_slot: number;
  phone_primary: number;
  phone_secondary: number;
};

export const LOW_CONFIDENCE = 0.75;

export function parseConfidence(json: string | null): Confidence | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Confidence;
  } catch {
    return null;
  }
}

export const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  no_answer: 'No answer',
  interested: 'Interested',
  quoted: 'Quoted',
  booked: 'Booked',
  not_interested: 'Not interested',
  callback: 'Callback'
};
