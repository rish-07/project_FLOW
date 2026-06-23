import { and, asc, eq, ne } from 'drizzle-orm';
import { createDb } from '$lib/server/db';
import { venues, leads } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
  const db = createDb(platform!.env.DB);

  const venueRows = await db.select().from(venues).orderBy(asc(venues.name));

  // Confirmed leads, soonest event first. 'not_interested' is excluded — those
  // are closed-lost and the owner doesn't want them cluttering the dashboard, so
  // marking a lead not interested effectively archives it off these tables.
  // Single-user, low volume — group in memory rather than a query per venue.
  const leadRows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.isConfirmed, true), ne(leads.status, 'not_interested')))
    .orderBy(asc(leads.eventDate));

  // Map DB columns to the leads-page shape (name/phone), grouped by venue.
  const leadsByVenue: Record<string, ReturnType<typeof toLead>[]> = {};
  for (const v of venueRows) leadsByVenue[v.id] = [];
  for (const r of leadRows) {
    (leadsByVenue[r.venueId] ??= []).push(toLead(r));
  }

  return {
    venues: venueRows.map((v) => ({
      id: v.id,
      name: v.name,
      count: leadsByVenue[v.id]?.length ?? 0,
      followUps: (leadsByVenue[v.id] ?? []).filter((l) => l.status === 'callback').length
    })),
    leadsByVenue
  };
};

function toLead(r: typeof leads.$inferSelect) {
  return {
    id: r.id,
    venueId: r.venueId,
    name: r.customerName,
    eventDate: r.eventDate,
    eventSlot: r.eventSlot,
    eventType: r.eventType,
    phone: r.phonePrimary,
    status: r.status,
    notes: r.notes
  };
}
