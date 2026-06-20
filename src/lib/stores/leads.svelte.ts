// Leads-page UI + data state, module-scoped so it survives `load` re-runs — e.g.
// open venues stay open after an import injects new rows (spec §9). selected and
// activeOverlay arrive in later sub-steps.

export type Status =
  | 'new'
  | 'no_answer'
  | 'interested'
  | 'quoted'
  | 'booked'
  | 'not_interested'
  | 'callback';

export type ShowcasePlan = 'track_show' | 'live_show' | 'track_entry' | 'live_entry';

export const PLAN_LABELS: Record<ShowcasePlan, string> = {
  track_show: 'Track Show',
  track_entry: 'Track with Entry',
  live_show: 'Live Show',
  live_entry: 'Live with Entry'
};

export interface Lead {
  id: string;
  venueId: string;
  name: string;
  eventDate: string; // YYYY-MM-DD
  eventTime: string;
  eventType: string;
  phone: string; // +91XXXXXXXXXX
  status: Status;
  notes: string | null;
  isNew?: boolean; // transient highlight after import
}

// activeOverlay is the seam for planned transactional flows (spec §8A): the
// Leads status handler will later call openOverlay() for specific transitions
// (e.g. booked → payment). It stays null/idle until those features are built.
export const leadsUi = $state<{
  openVenues: Record<string, boolean>;
  leadsByVenue: Record<string, Lead[]>;
  activeOverlay: { type: string; leadId: string } | null;
}>({
  openVenues: {},
  leadsByVenue: {},
  activeOverlay: null
});

export function toggleVenue(id: string): void {
  leadsUi.openVenues[id] = !leadsUi.openVenues[id];
}

export function openOverlay(type: string, leadId: string): void {
  leadsUi.activeOverlay = { type, leadId };
}
export function closeOverlay(): void {
  leadsUi.activeOverlay = null;
}

// Injection seam for the import pipeline (spec §8B): mutates only the given
// venue's array so other venues + accordion/scroll state stay untouched. New
// rows are flagged isNew for a brief fade-in highlight on the Leads table.
export function addLeads(venueId: string, rows: Lead[]): void {
  const fresh = rows.map((r) => ({ ...r, isNew: true }));
  const existing = leadsUi.leadsByVenue[venueId] ?? [];
  leadsUi.leadsByVenue[venueId] = [...fresh, ...existing];
  leadsUi.openVenues[venueId] = true; // reveal the venue so the new rows are visible
}
