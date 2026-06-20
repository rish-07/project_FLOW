// Leads-page UI + data state, module-scoped so it survives `load` re-runs. The
// rail + open-spread layout (design-system.md §9) keeps exactly one venue
// "open" at a time, rather than independent per-venue accordions — an import
// switches the active venue so the new rows are immediately visible.

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
  activeVenueId: string | null;
  leadsByVenue: Record<string, Lead[]>;
  activeOverlay: { type: string; leadId: string } | null;
}>({
  activeVenueId: null,
  leadsByVenue: {},
  activeOverlay: null
});

export function setActiveVenue(id: string): void {
  leadsUi.activeVenueId = id;
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
  leadsUi.activeVenueId = venueId; // open this venue so the new rows are visible
}
