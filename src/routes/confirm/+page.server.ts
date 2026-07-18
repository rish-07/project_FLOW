import { redirect, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { createDb } from '$lib/server/db';
import { leads } from '$lib/server/db/schema';
import { normalisePhone, parseConfidence } from '$lib/utils';
import type { Actions, PageServerLoad } from './$types';

type KeptLead = {
  id: string;
  customerName: string;
  eventType: string;
  eventDate: string;
  eventSlot: string;
  phonePrimary: string;
  phoneSecondary: string;
  notes: string;
};

export const load: PageServerLoad = async ({ url, platform }) => {
  const sessionId = url.searchParams.get('session');
  if (!sessionId) throw redirect(302, '/upload');

  const db = createDb(platform!.env.DB);
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.sessionId, sessionId), eq(leads.isConfirmed, false)));

  return {
    sessionId,
    // Each booking carries its own source page so the confirm screen can show
    // that page directly above the booking's fields for cross-checking.
    leads: rows.map((r) => ({
      id: r.id,
      customerName: r.customerName,
      eventType: r.eventType,
      eventDate: r.eventDate,
      eventSlot: r.eventSlot,
      phonePrimary: r.phonePrimary,
      phoneSecondary: r.phoneSecondary ?? '',
      notes: r.notes ?? '',
      sourceImageKey: r.sourceImageKey,
      confidence: parseConfidence(r.extractionConfidence)
    }))
  };
};

export const actions: Actions = {
  // The only write path off this screen. Confirms the kept (possibly edited)
  // bookings and drops the ones she removed. Nothing is auto-saved.
  save: async ({ request, platform }) => {
    const db = createDb(platform!.env.DB);
    const form = await request.formData();
    const sessionId = String(form.get('session_id') ?? '');
    if (!sessionId) return fail(400, { error: 'Missing session.' });

    let kept: KeptLead[];
    try {
      kept = JSON.parse(String(form.get('payload') ?? '[]'));
    } catch {
      return fail(400, { error: 'Could not read the edited bookings.' });
    }

    if (kept.length === 0) {
      return fail(400, { error: 'Keep at least one booking, or go back and upload again.' });
    }

    for (const l of kept) {
      if (
        !l.customerName?.trim() ||
        !l.eventType?.trim() ||
        !l.eventDate?.trim() ||
        !l.phonePrimary?.trim()
      ) {
        return fail(400, {
          error: 'Each booking needs a name, event type, date and primary phone.'
        });
      }
    }

    // Confirm + persist edits. Re-normalise phones so tel:/wa.me links are clean;
    // fall back to her exact text if it can't be recovered (don't lose a fix).
    for (const l of kept) {
      const primary = normalisePhone(l.phonePrimary) || l.phonePrimary.trim();
      const secondary = l.phoneSecondary?.trim()
        ? normalisePhone(l.phoneSecondary) || l.phoneSecondary.trim()
        : null;

      await db
        .update(leads)
        .set({
          customerName: l.customerName.trim(),
          eventType: l.eventType.trim(),
          eventDate: l.eventDate.trim(),
          eventSlot: l.eventSlot === 'PM' ? 'PM' : 'AM',
          phonePrimary: primary,
          phoneSecondary: secondary,
          notes: l.notes?.trim() || null,
          isConfirmed: true
        })
        .where(
          and(eq(leads.id, l.id), eq(leads.sessionId, sessionId), eq(leads.isConfirmed, false))
        );
    }

    // Whatever is still unconfirmed in this session was removed on the confirm
    // screen — delete it so it never surfaces as a lead.
    await db.delete(leads).where(and(eq(leads.sessionId, sessionId), eq(leads.isConfirmed, false)));

    throw redirect(303, '/leads');
  }
};
