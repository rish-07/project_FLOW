import { fail } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { createDb } from '$lib/server/db';
import { venues } from '$lib/server/db/schema';
import { normalisePhone } from '$lib/utils';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, url }) => {
  const db = createDb(platform!.env.DB);
  const list = await db.select().from(venues).orderBy(asc(venues.name));
  // ?venue=<id> pre-selects a venue (per-venue Import entry point, spec §8B).
  return { venues: list, preselectVenueId: url.searchParams.get('venue') };
};

export const actions: Actions = {
  // Inline "add a venue" — no modal, no navigation. Returns the new id so the
  // page can select it in the dropdown immediately.
  addVenue: async ({ request, platform }) => {
    const db = createDb(platform!.env.DB);
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const phoneRaw = String(form.get('phone') ?? '').trim();

    if (!name) return fail(400, { addError: 'Venue name is required.' });

    // Keep a clean 10-digit number when we can recover one; otherwise store the
    // raw text so nothing she typed is silently dropped.
    const phone = phoneRaw ? normalisePhone(phoneRaw) || phoneRaw : null;
    const id = crypto.randomUUID();
    await db.insert(venues).values({ id, name, phone });

    return { newVenueId: id };
  }
};
