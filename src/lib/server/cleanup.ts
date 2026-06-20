// Retention sweep for abandoned uploads.
//
// An upload writes a diary photo to R2 and inserts unconfirmed `leads` rows. If
// she never finishes the confirm step, those rows + the photo (which contain
// customer names and phone numbers) would otherwise live forever. This deletes
// unconfirmed leads older than the threshold and removes any R2 photo no
// surviving lead still references.
//
// Invoked opportunistically on each upload (via waitUntil) so it needs no extra
// infrastructure. If you'd rather run it on a fixed cadence, a Cloudflare Cron
// Trigger calling this same function once a month is a drop-in alternative.

import { and, eq, inArray, lt } from 'drizzle-orm';
import { leads } from '$lib/server/db/schema';
import type { createDb } from '$lib/server/db';
import type { R2Bucket } from '@cloudflare/workers-types';

const RETENTION_DAYS = 30;

export async function cleanupStaleLeads(
  db: ReturnType<typeof createDb>,
  bucket: R2Bucket
): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const stale = await db
    .select({ id: leads.id, key: leads.sourceImageKey })
    .from(leads)
    .where(and(eq(leads.isConfirmed, false), lt(leads.createdAt, cutoff)));

  if (stale.length === 0) return;

  await db.delete(leads).where(
    inArray(
      leads.id,
      stale.map((s) => s.id)
    )
  );

  // Delete each photo only if no remaining lead (confirmed or not) references it.
  const keys = [...new Set(stale.map((s) => s.key).filter((k): k is string => !!k))];
  for (const key of keys) {
    const stillUsed = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.sourceImageKey, key))
      .limit(1);
    if (stillUsed.length === 0) await bucket.delete(key);
  }
}
