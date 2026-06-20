import { and, asc, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { createDb } from '$lib/server/db';
import { venues, leads } from '$lib/server/db/schema';
import { todayISO } from '$lib/utils';
import type { PageServerLoad } from './$types';

// Today's worklist (brief §9 Calls): confirmed leads still needing a call —
// status in {new, no_answer, callback} and (no follow-up date set, or it's due).
// Sorted by event_date asc so the soonest events surface first.
export const load: PageServerLoad = async ({ platform }) => {
  const db = createDb(platform!.env.DB);
  const today = todayISO();

  const rows = await db
    .select({
      id: leads.id,
      customerName: leads.customerName,
      eventType: leads.eventType,
      eventDate: leads.eventDate,
      phonePrimary: leads.phonePrimary,
      status: leads.status,
      nextFollowupOn: leads.nextFollowupOn,
      venueName: venues.name
    })
    .from(leads)
    .innerJoin(venues, eq(leads.venueId, venues.id))
    .where(
      and(
        eq(leads.isConfirmed, true),
        inArray(leads.status, ['new', 'no_answer', 'callback']),
        or(isNull(leads.nextFollowupOn), lte(leads.nextFollowupOn, today))
      )
    )
    .orderBy(asc(leads.eventDate));

  return { calls: rows };
};
