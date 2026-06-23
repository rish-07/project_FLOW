import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { createDb } from '$lib/server/db';
import { venues, leads } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

// Removing a venue takes its leads with it — there is no "orphaned lead" state
// in this app, so this is intentionally a real delete, not an archive. The two
// statements run as one D1 batch (atomic): leads.venue_id has no ON DELETE
// CASCADE, so deleting the venue first would fail the foreign key, and running
// them as separate calls could leave leads stranded if the second one failed.
export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  const id = params.id;
  if (!id) throw error(400, 'Missing id');

  const db = createDb(platform!.env.DB);

  const [venue] = await db.select().from(venues).where(eq(venues.id, id));
  if (!venue) throw error(404, 'Venue not found');

  await db.batch([
    db.delete(leads).where(eq(leads.venueId, id)),
    db.delete(venues).where(eq(venues.id, id))
  ]);

  return json({ ok: true });
};
