import { asc, eq } from 'drizzle-orm';
import { createDb } from '$lib/server/db';
import { venues, leads } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
  const db = createDb(platform!.env.DB);

  const venueRows = await db.select().from(venues).orderBy(asc(venues.name));

  // Header counts only (total confirmed leads + callback follow-ups per venue).
  // Single-user, low volume — compute in memory rather than per-venue queries.
  const confirmed = await db
    .select({ venueId: leads.venueId, status: leads.status })
    .from(leads)
    .where(eq(leads.isConfirmed, true));

  const totals = new Map<string, number>();
  const followUps = new Map<string, number>();
  for (const l of confirmed) {
    totals.set(l.venueId, (totals.get(l.venueId) ?? 0) + 1);
    if (l.status === 'callback') followUps.set(l.venueId, (followUps.get(l.venueId) ?? 0) + 1);
  }

  return {
    venues: venueRows.map((v) => ({
      id: v.id,
      name: v.name,
      count: totals.get(v.id) ?? 0,
      followUps: followUps.get(v.id) ?? 0
    }))
  };
};
