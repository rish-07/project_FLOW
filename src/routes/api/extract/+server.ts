import { json, error } from '@sveltejs/kit';
import { extractBookings } from '$lib/server/gemini';
import { createDb } from '$lib/server/db';
import { leads } from '$lib/server/db/schema';
import { normalisePhone } from '$lib/utils';
import { cleanupStaleLeads } from '$lib/server/cleanup';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  const env = platform!.env;
  const form = await request.formData();
  const file = form.get('file');
  const venueId = form.get('venue_id');

  if (!(file instanceof File) || typeof venueId !== 'string') {
    throw error(400, 'Missing file or venue_id');
  }

  // Guard the Gemini call: reject non-images and oversized uploads before we pay
  // for an extraction. Empty type (some camera captures) is allowed and treated
  // as JPEG below.
  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
  if (file.type && !file.type.startsWith('image/')) {
    throw error(415, 'Please upload an image file.');
  }
  if (file.size > MAX_BYTES) {
    throw error(413, 'Image is too large (max 10 MB).');
  }

  const buffer = await file.arrayBuffer();
  const mimeType = file.type || 'image/jpeg';
  const imageKey = `diary-photos/${venueId}/${Date.now()}.jpg`;
  const sessionId = crypto.randomUUID();

  // Sweep abandoned uploads on the way in. Cheap, single-user; never blocks the
  // response (and never fails it). See $lib/cleanup for the retention policy.
  const db = createDb(env.DB);
  platform!.context?.waitUntil?.(cleanupStaleLeads(db, env.DIARY_PHOTOS).catch(() => {}));

  // 1. store original photo in R2
  await env.DIARY_PHOTOS.put(imageKey, buffer, {
    httpMetadata: { contentType: mimeType }
  });

  // 2. extract with Gemini (throws on invalid JSON -> 422 with a clear message)
  let extracted;
  try {
    extracted = await extractBookings(buffer, env.GEMINI_API_KEY, mimeType);
  } catch (e) {
    throw error(422, e instanceof Error ? e.message : 'Extraction failed');
  }

  if (extracted.length === 0) {
    return json({ session_id: sessionId, count: 0 });
  }

  // 3. insert as unconfirmed leads. Re-normalise phones server-side: if a number
  //    can't be recovered to 10 clean digits we keep the raw read (so she can fix
  //    it on the confirm screen) and force its confidence below the 0.75 flag
  //    threshold, so an amber caution chip appears beside it.
  await db.insert(leads).values(
    extracted.map((b) => {
      const primary = normalisePhone(b.phone_primary);
      const secondary = b.phone_secondary ? normalisePhone(b.phone_secondary) : '';
      const confidence = {
        ...b.confidence,
        phone_primary: primary ? b.confidence.phone_primary : Math.min(b.confidence.phone_primary, 0.3),
        phone_secondary:
          !b.phone_secondary || secondary
            ? b.confidence.phone_secondary
            : Math.min(b.confidence.phone_secondary, 0.3)
      };

      return {
        sessionId,
        venueId,
        customerName: b.customer_name,
        eventType: b.event_type,
        eventDate: b.event_date,
        eventTime: b.event_time,
        phonePrimary: primary || b.phone_primary,
        phoneSecondary: b.phone_secondary ? secondary || b.phone_secondary : null,
        sourceImageKey: imageKey,
        extractionConfidence: JSON.stringify(confidence),
        isConfirmed: false
      };
    })
  );

  return json({ session_id: sessionId, count: extracted.length });
};
