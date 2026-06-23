import { json, error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { createDb } from '$lib/server/db';
import { leads } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const STATUSES = [
  'new',
  'no_answer',
  'interested',
  'quoted',
  'booked',
  'not_interested',
  'callback'
] as const;
type Status = (typeof STATUSES)[number];

type Patch = {
  status?: Status;
  nextFollowupOn?: string | null;
  lastContactedAt?: boolean; // true -> stamp now()
  notes?: string | null; // inline notes edit from the leads dashboard
};

// One-tap status logging from the call list (and later the leads dashboard).
// All leads mutations go through here — no direct D1 access from components.
export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  const id = params.id;
  if (!id) throw error(400, 'Missing id');

  let body: Patch;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const set: Partial<typeof leads.$inferInsert> = {};

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw error(400, 'Invalid status');
    set.status = body.status;
  }
  if (body.nextFollowupOn !== undefined) {
    set.nextFollowupOn = body.nextFollowupOn || null;
  }
  if (body.lastContactedAt) {
    set.lastContactedAt = new Date();
  }
  if (body.notes !== undefined) {
    const trimmed = typeof body.notes === 'string' ? body.notes.trim() : '';
    set.notes = trimmed === '' ? null : trimmed;
  }

  if (Object.keys(set).length === 0) throw error(400, 'Nothing to update');

  const db = createDb(platform!.env.DB);
  await db.update(leads).set(set).where(eq(leads.id, id));
  return json({ ok: true });
};
