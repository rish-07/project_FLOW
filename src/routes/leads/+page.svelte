<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { fly, fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import {
    leadsUi,
    setActiveVenue,
    PLAN_LABELS,
    type Lead,
    type Status,
    type ShowcasePlan
  } from '$lib/stores/leads.svelte';
  import { humanDate, formatDateSlot, telLink } from '$lib/utils';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import SendMenu from '$lib/components/SendMenu.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Import entry points route into the existing upload → extract → confirm
  // pipeline. A per-venue Import pre-selects that venue; the trailing rail
  // tab omits it so /upload asks which venue first.
  function importPhoto(venueId?: string) {
    goto(venueId ? `/upload?venue=${venueId}` : '/upload');
  }

  // ── Remove venue ─────────────────────────────────────────────────
  // Removing a venue takes its leads with it (no orphaned-lead state in this
  // app), so this is a real, irreversible delete — confirm before calling it.
  let removingVenue = $state<{ id: string; name: string; count: number } | null>(null);
  let removeBusy = $state(false);

  function startRemoveVenue(v: { id: string; name: string; count: number }) {
    removingVenue = v;
  }
  function cancelRemoveVenue() {
    if (removeBusy) return;
    removingVenue = null;
  }
  async function confirmRemoveVenue() {
    if (!removingVenue || removeBusy) return;
    const id = removingVenue.id;
    removeBusy = true;
    try {
      const res = await fetch(`/api/venues/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      delete leadsUi.leadsByVenue[id];
      if (leadsUi.activeVenueId === id) leadsUi.activeVenueId = null; // re-derive to the next venue
      removingVenue = null;
      await invalidateAll();
    } catch {
      showToast("Couldn't remove the venue — check your connection.");
    } finally {
      removeBusy = false;
    }
  }

  // Rail order: most urgent first (follow-ups due, then lead count) — the
  // asymmetry encodes priority, not just available space (design-system.md §4).
  const rankedVenues = $derived(
    [...data.venues].sort((a, b) => b.followUps - a.followUps || b.count - a.count)
  );

  // The DB is the source of truth: (re)seed the store from each server load.
  // Optimistic edits live in the store between loads and are persisted via PATCH,
  // so overwriting on the next load simply reflects what was saved. Reads only
  // `data` so switching venue tabs (which changes activeVenueId) never re-seeds
  // and clobbers an in-flight optimistic edit.
  $effect(() => {
    for (const v of data.venues) {
      leadsUi.leadsByVenue[v.id] = (data.leadsByVenue[v.id] ?? []).map((l) => ({
        ...l,
        status: l.status as Status
      }));
    }
  });

  // Default the open venue to the most urgent one once data is available.
  $effect(() => {
    if (!leadsUi.activeVenueId && data.venues.length) {
      setActiveVenue(rankedVenues[0]?.id ?? data.venues[0].id);
    }
  });

  const activeVenue = $derived(
    rankedVenues.find((v) => v.id === leadsUi.activeVenueId) ?? rankedVenues[0]
  );
  const activeVenueLeads = $derived(
    activeVenue ? sortLeads(leadsUi.leadsByVenue[activeVenue.id] ?? []) : []
  );

  // Mutate one lead in the store in place; returns the previous value of the
  // patched field so a failed save can be rolled back.
  function patchLeadLocal<K extends keyof Lead>(leadId: string, key: K, value: Lead[K]): Lead[K] | undefined {
    for (const arr of Object.values(leadsUi.leadsByVenue)) {
      const idx = arr.findIndex((l) => l.id === leadId);
      if (idx !== -1) {
        const prev = arr[idx][key];
        arr[idx] = { ...arr[idx], [key]: value };
        return prev;
      }
    }
    return undefined;
  }

  // Persist a single field through the one leads mutation route. Optimistic:
  // the store is updated first; on failure we revert and warn.
  async function persistLead(leadId: string, body: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function handleStatusChange(leadId: string, newStatus: Status) {
    const prev = patchLeadLocal(leadId, 'status', newStatus);
    if (prev === undefined || prev === newStatus) return;
    if (await persistLead(leadId, { status: newStatus })) {
      // Re-pull every load so Calls, venue counts, and the not-interested
      // filter all reflect the change (SvelteKit caches loads between routes).
      await invalidateAll();
    } else {
      patchLeadLocal(leadId, 'status', prev);
      showToast("Couldn't save the status — check your connection.");
    }
  }

  // ── Inline notes editing ────────────────────────────────────────
  // A pencil in the Notes cell opens a small sheet (the cell is too narrow and
  // the row height too clamped for an in-place textarea). Saving persists through
  // PATCH /api/leads/[id] (optimistic, with rollback on failure).
  let editingNotes = $state<{ id: string; name: string } | null>(null);
  let notesDraft = $state('');

  function startEditNotes(lead: Lead) {
    editingNotes = { id: lead.id, name: lead.name };
    notesDraft = lead.notes ?? '';
  }
  function cancelEditNotes() {
    editingNotes = null;
    notesDraft = '';
  }
  async function saveNotes() {
    if (!editingNotes) return;
    const id = editingNotes.id;
    const next = notesDraft.trim() === '' ? null : notesDraft.trim();
    editingNotes = null;
    notesDraft = '';

    const prev = patchLeadLocal(id, 'notes', next);
    if (prev === undefined || prev === next) return;
    if (await persistLead(id, { notes: next })) {
      await invalidateAll();
    } else {
      patchLeadLocal(id, 'notes', prev);
      showToast("Couldn't save the note — check your connection.");
    }
  }

  // Focus the field when the sheet opens (keyboard + clear intent).
  function focusOnMount(node: HTMLTextAreaElement) {
    node.focus();
  }

  let toast = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  function showToast(msg: string) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 3000);
  }

  function handleSendShowcase(leadId: string, plan: ShowcasePlan) {
    let name = '';
    for (const arr of Object.values(leadsUi.leadsByVenue)) {
      const lead = arr.find((l) => l.id === leadId);
      if (lead) {
        name = lead.name;
        break;
      }
    }
    toast = `${PLAN_LABELS[plan]} ready to send${name ? ` to ${name}` : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 3000);
  }

  function toastFly() {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { y: reduced ? 0 : 8, duration: reduced ? 0 : 300 };
  }

  // Spread swap (design-system.md §6, signature motion #2): crossfade only,
  // exit faster than enter. No slide — same desk, a different book open.
  function spreadFade(dir: 'in' | 'out') {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return { duration: 0 };
    return dir === 'in' ? { duration: 200 } : { duration: 150 };
  }

  const STATUS_ORDER: Record<Status, number> = {
    new: 0,
    no_answer: 1,
    callback: 2,
    interested: 3,
    quoted: 4,
    booked: 5,
    not_interested: 6
  };
  function sortLeads(arr: Lead[]): Lead[] {
    return [...arr].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }

  function flipParams() {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { duration: reduced ? 0 : 300 };
  }

  // Combined date + slot for the cell's accessible label / tooltip.
  function dateSlotLabel(lead: Lead): string {
    return formatDateSlot(lead.eventDate, lead.eventSlot);
  }

  function prettyPhone(phone: string): string {
    const m = phone.match(/^\+91(\d{5})(\d{5})$/);
    return m ? `+91 ${m[1]} ${m[2]}` : phone;
  }
</script>

<svelte:head><title>Leads · Booking Capture</title></svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && editingNotes) cancelEditNotes(); }} />

<div class="leads-page">
  <header class="page-head">
    <h1 class="page-title text-h3">Leads</h1>
  </header>

  {#if data.venues.length === 0}
    <p class="no-venues">No venues yet. Add one from the Upload screen to start grouping leads.</p>
  {:else}
    <div class="ledger-desk">
      <!-- Rail: closed venue tabs, sorted by urgency. Horizontal strip on
           mobile, fixed-width vertical rail at lg+ (design-system.md §4/§5/§9). -->
      <nav class="rail" aria-label="Venues">
        {#each rankedVenues as v (v.id)}
          {@const isActive = v.id === activeVenue?.id}
          <button
            type="button"
            class="rail-tab"
            class:active={isActive}
            aria-current={isActive ? 'true' : undefined}
            onclick={() => setActiveVenue(v.id)}
          >
            <span class="rail-tab-name">{v.name}</span>
            <span class="rail-tab-count tabular">
              {v.count}{v.followUps > 0 ? ` · ${v.followUps} due` : ''}
            </span>
          </button>
        {/each}
        <button type="button" class="rail-tab rail-tab-add" onclick={() => importPhoto()}>
          <svg class="add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Add venue</span>
        </button>
      </nav>

      <!-- Open spread: the dominant zone, full-bleed, no card chrome (§5/§7). -->
      {#if activeVenue}
        {#key activeVenue.id}
          <div
            class="spread"
            role="region"
            aria-label={`${activeVenue.name} leads`}
            in:fade={spreadFade('in')}
            out:fade={spreadFade('out')}
          >
            <div class="spread-head">
              <h2 class="spread-title text-h3">{activeVenue.name}</h2>
              <div class="spread-head-actions">
                <button type="button" class="import-link" onclick={() => importPhoto(activeVenue.id)}>
                  Import photo
                </button>
                <button
                  type="button"
                  class="remove-venue-btn"
                  aria-label={`Remove ${activeVenue.name}`}
                  onclick={() => startRemoveVenue(activeVenue)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>

            {#if activeVenueLeads.length === 0}
              <div class="leads-empty">
                <svg class="leads-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                <p class="leads-empty-text">No leads yet for this venue.</p>
                <button class="ghost-btn" type="button" onclick={() => importPhoto(activeVenue.id)}>Import from photo</button>
              </div>
            {:else}
              <ul class="lead-cards">
                {#each activeVenueLeads as lead (lead.id)}
                  <li class="lead-card" class:is-new={lead.isNew} animate:flip={flipParams()}>
                    <div class="card-top">
                      <span class="card-datetime" title={dateSlotLabel(lead)}>
                        <span class="card-date tabular">{humanDate(lead.eventDate)}</span>
                        {#if lead.eventSlot}<span class="card-slot tabular">{lead.eventSlot}</span>{/if}
                      </span>
                      <StatusPill
                        leadId={lead.id}
                        status={lead.status}
                        name={lead.name}
                        onStatusChange={handleStatusChange}
                      />
                    </div>

                    <h3 class="card-name" title={lead.name}>{lead.name}</h3>
                    <p class="card-type">{lead.eventType}</p>

                    <div class="card-phones">
                      <a class="card-phone card-phone-primary tabular" href={telLink(lead.phone)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                        </svg>
                        {prettyPhone(lead.phone)}
                      </a>
                      {#if lead.phoneSecondary}
                        <a class="card-phone card-phone-secondary tabular" href={telLink(lead.phoneSecondary)}>
                          {prettyPhone(lead.phoneSecondary)}
                        </a>
                      {/if}
                    </div>

                    <div class="card-foot">
                      <span class="card-notes" class:empty={!lead.notes} title={lead.notes ?? ''}>
                        {lead.notes ?? 'No notes yet'}
                      </span>
                      <div class="card-actions">
                        <button
                          type="button"
                          class="notes-edit"
                          aria-label={`Edit notes for ${lead.name}`}
                          onclick={() => startEditNotes(lead)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                          </svg>
                        </button>
                        <SendMenu leadId={lead.id} name={lead.name} onSendShowcase={handleSendShowcase} />
                      </div>
                    </div>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/key}
      {/if}
    </div>
  {/if}
</div>

{#if editingNotes}
  <div
    class="notes-scrim"
    role="presentation"
    onclick={cancelEditNotes}
    transition:fade={spreadFade('in')}
  ></div>
  <div class="notes-sheet" role="dialog" aria-modal="true" aria-label={`Edit notes for ${editingNotes.name}`}>
    <p class="notes-sheet-title">Notes · {editingNotes.name}</p>
    <textarea
      class="notes-sheet-field"
      rows="4"
      placeholder="Add a note — e.g. callback after Diwali, wants a quote for 250."
      bind:value={notesDraft}
      use:focusOnMount
    ></textarea>
    <div class="notes-sheet-actions">
      <button type="button" class="notes-sheet-cancel" onclick={cancelEditNotes}>Cancel</button>
      <button type="button" class="btn-primary notes-sheet-save" onclick={saveNotes}>Save notes</button>
    </div>
  </div>
{/if}

{#if removingVenue}
  <div
    class="notes-scrim"
    role="presentation"
    onclick={cancelRemoveVenue}
    transition:fade={spreadFade('in')}
  ></div>
  <div class="notes-sheet" role="dialog" aria-modal="true" aria-label={`Remove ${removingVenue.name}`}>
    <p class="notes-sheet-title">Remove {removingVenue.name}?</p>
    <p class="remove-venue-warning">
      This deletes {removingVenue.count}
      {removingVenue.count === 1 ? 'lead' : 'leads'} for this venue too — it can't be undone.
    </p>
    <div class="notes-sheet-actions">
      <button type="button" class="notes-sheet-cancel" onclick={cancelRemoveVenue} disabled={removeBusy}>
        Cancel
      </button>
      <button type="button" class="remove-venue-confirm" onclick={confirmRemoveVenue} disabled={removeBusy}>
        {removeBusy ? 'Removing…' : 'Remove venue'}
      </button>
    </div>
  </div>
{/if}

{#if toast}
  <div class="toast" role="status" transition:fly={toastFly()}>
    {toast}
  </div>
{/if}

<style>
  .leads-page {
    width: 100%;
    max-width: 1280px;
    margin-inline: auto;
    padding-block: var(--spacing-3);
  }

  .page-head {
    margin-bottom: var(--spacing-3);
  }
  .page-title {
    color: var(--color-text-primary);
  }

  .no-venues {
    font-size: var(--text-sm);
    color: var(--color-text-tertiary);
  }

  /* ── The desk: rail + open spread (design-system.md §4/§9) ─────────────── */
  .ledger-desk {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  /* Rail — horizontal scroll strip on mobile/tablet. */
  .rail {
    display: flex;
    gap: var(--spacing-0h);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-bottom: var(--spacing-0h);
  }
  .rail-tab {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-0h);
    min-width: 9rem;
    min-height: 56px;
    padding: var(--spacing-1) var(--spacing-2);
    text-align: left;
    background-color: transparent;
    border-left: 2px solid transparent;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      background-color var(--duration-base) var(--ease-premium),
      border-color var(--duration-base) var(--ease-premium);
  }
  .rail-tab:hover {
    background-color: var(--color-bg-sunken);
  }
  .rail-tab.active {
    background-color: var(--color-bg-elevated);
    border-left-color: var(--color-accent);
  }
  .rail-tab-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rail-tab-count {
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
  }
  .rail-tab-add {
    align-items: center;
    justify-content: center;
    flex-direction: row;
    gap: var(--spacing-0h);
    min-width: 7rem;
    color: var(--color-text-secondary);
  }
  .add-icon {
    width: 1rem;
    height: 1rem;
  }

  /* Open spread — no card chrome; a 1px hairline rule is its only border,
     against the rail's sunken tone (design-system.md §5/§7). */
  .spread {
    background-color: var(--color-bg-elevated);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border-base);
    overflow: hidden;
  }
  /* A filled header band + stronger rule so the venue title reads as the panel's
     header, not the first row of the card stack below it. */
  .spread-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-2);
    padding: var(--spacing-2);
    background-color: var(--color-bg-sunken);
    border-bottom: 1px solid var(--color-border-strong);
  }
  .spread-title {
    color: var(--color-text-primary);
  }
  .import-link {
    flex-shrink: 0;
    min-height: 44px;
    padding-inline: var(--spacing-1);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-accent-text);
    transition: color var(--duration-base) var(--ease-premium);
  }
  .import-link:hover {
    color: var(--color-accent);
  }

  .spread-head-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
  }
  /* Quiet by default — destructive actions don't compete visually with
     "Import photo" until the user actually reaches for it. */
  .remove-venue-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    color: var(--color-text-tertiary);
    background-color: transparent;
    transition:
      color var(--duration-base) var(--ease-premium),
      background-color var(--duration-base) var(--ease-premium);
  }
  .remove-venue-btn svg {
    width: 1.125rem;
    height: 1.125rem;
  }
  .remove-venue-btn:hover {
    color: var(--color-danger-text);
    background-color: var(--color-danger-bg);
  }

  .ghost-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-1);
    min-height: 44px;
    padding-inline: var(--spacing-2);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
    background-color: transparent;
    transition:
      color var(--duration-base) var(--ease-premium),
      background-color var(--duration-base) var(--ease-premium);
  }
  .ghost-btn:hover {
    color: var(--color-accent-text);
    background-color: var(--color-bg-sunken);
  }

  /* ── Per-venue empty state ─────────────────────────────────────────────── */
  .leads-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-1);
    padding-block: var(--spacing-4);
    text-align: center;
  }
  .leads-empty-icon {
    width: 1.5rem;
    height: 1.5rem;
    color: var(--color-text-tertiary);
  }
  .leads-empty-text {
    font-size: var(--text-sm);
    color: var(--color-text-tertiary);
  }

  /* ── Lead cards (vertical layout — uses vertical space, no horizontal scroll,
     so the page never exceeds the viewport width) ───────────────────────── */
  .lead-cards {
    display: flex;
    flex-direction: column;
    list-style: none;
  }
  .lead-card {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-0h);
    padding: var(--spacing-2);
    border-top: 1px solid var(--color-border-base);
    transition: background-color var(--duration-base) var(--ease-premium);
  }
  .lead-card:first-child {
    border-top: none;
  }
  /* Alternating tone keeps adjacent cards distinct without heavy borders — kept
     gentle (a partial sunken tint) so it whispers rather than stripes. */
  .lead-card:nth-child(even) {
    background-color: color-mix(in srgb, var(--color-bg-sunken), var(--color-bg-elevated) 55%);
  }
  .lead-card.is-new {
    animation: lead-card-new var(--duration-long) var(--ease-enter);
  }
  @keyframes lead-card-new {
    from { background-color: var(--color-accent-subtle); }
    to   { background-color: transparent; }
  }

  /* Top row: date + slot on the left, status pill on the right. */
  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-2);
  }
  .card-datetime {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-1);
    min-width: 0;
  }
  .card-date {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
  /* AM/PM tag — a bordered mono chip so it reads on either alternating tone. */
  .card-slot {
    flex-shrink: 0;
    padding: 0.0625rem 0.3125rem;
    border: 1px solid var(--color-border-base);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    font-weight: 600;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-secondary);
  }

  /* Name — the card's headline. */
  .card-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: var(--leading-snug);
    color: var(--color-text-primary);
  }
  .card-type {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .card-phones {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-0h);
    margin-top: var(--spacing-0h);
  }
  .card-phone {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-1);
    align-self: flex-start;
    font-family: var(--font-mono);
    transition: color var(--duration-base) var(--ease-premium);
  }
  .card-phone svg {
    flex-shrink: 0;
    width: 0.875rem;
    height: 0.875rem;
  }
  .card-phone-primary {
    font-size: var(--text-sm);
    color: var(--color-text-primary);
  }
  .card-phone-secondary {
    padding-left: calc(0.875rem + var(--spacing-1)); /* align under the primary's text */
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
  }
  .card-phone:hover {
    color: var(--color-accent-text);
  }

  /* Bottom row: notes preview + edit + send. */
  .card-foot {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    margin-top: var(--spacing-1);
    padding-top: var(--spacing-1);
    border-top: 1px solid var(--color-border-base);
  }
  .card-notes {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
  .card-notes.empty {
    color: var(--color-text-tertiary);
    font-style: italic;
  }
  .card-actions {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-0h);
  }
  /* Notes pencil — always visible in the card (room for it, and touch-first). */
  .notes-edit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    color: var(--color-text-tertiary);
    background-color: transparent;
    cursor: pointer;
    transition:
      color var(--duration-base) var(--ease-premium),
      background-color var(--duration-base) var(--ease-premium);
  }
  .notes-edit svg {
    width: 1rem;
    height: 1rem;
  }
  .notes-edit:hover {
    color: var(--color-accent-text);
    background-color: var(--color-accent-subtle);
  }

  /* ── Notes edit sheet (centred dialog; mobile-friendly) ────────────────── */
  .notes-scrim {
    position: fixed;
    inset: 0;
    z-index: 80;
    background-color: var(--color-bg-overlay);
  }
  .notes-sheet {
    position: fixed;
    z-index: 81;
    left: var(--spacing-2);
    right: var(--spacing-2);
    bottom: calc(env(safe-area-inset-bottom, 0px) + var(--spacing-2));
    max-width: 480px;
    margin-inline: auto;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    padding: var(--spacing-3);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border-base);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }
  .notes-sheet-title {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-primary);
  }
  .remove-venue-warning {
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--color-text-secondary);
  }
  .remove-venue-confirm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding-inline: var(--spacing-3);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-danger-text);
    background-color: var(--color-danger-bg);
    transition: opacity var(--duration-base) var(--ease-premium);
  }
  .remove-venue-confirm:hover {
    opacity: 0.85;
  }
  .remove-venue-confirm:disabled,
  .notes-sheet-cancel:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .notes-sheet-field {
    width: 100%;
    min-height: 96px;
    padding: var(--spacing-2);
    background-color: var(--color-bg-base);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font: inherit;
    font-size: var(--text-base);
    line-height: var(--leading-normal);
    color: var(--color-text-primary);
    resize: vertical;
    transition:
      border-color var(--duration-base) var(--ease-premium),
      box-shadow var(--duration-base) var(--ease-premium);
  }
  .notes-sheet-field:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-subtle);
  }
  .notes-sheet-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--spacing-2);
  }
  .notes-sheet-cancel {
    min-height: 44px;
    padding-inline: var(--spacing-2);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
    transition: color var(--duration-base) var(--ease-premium);
  }
  .notes-sheet-cancel:hover {
    color: var(--color-text-primary);
  }
  .notes-sheet-save {
    min-height: 44px;
  }

  /* ── lg+: rail becomes a fixed-width vertical column ────────────────────── */
  @media (min-width: 1024px) {
    .ledger-desk {
      flex-direction: row;
      align-items: flex-start;
      gap: var(--spacing-3);
    }
    .rail {
      flex: 0 0 var(--rail-width);
      flex-direction: column;
      overflow-x: visible;
      background-color: var(--color-bg-sunken);
      border-radius: var(--radius-lg);
      padding: var(--spacing-1);
    }
    .rail-tab {
      min-width: 0;
    }
    .spread {
      flex: 1;
      min-width: 0;
    }
  }

  /* Toast — interim confirmation for the stubbed showcase dispatch. */
  .toast {
    position: fixed;
    z-index: 70;
    /* Clear the floating nav pill at the viewport bottom. */
    bottom: calc(env(safe-area-inset-bottom, 0px) + 5rem);
    left: var(--spacing-2);
    right: var(--spacing-2);
    max-width: 480px;
    margin-inline: auto;
    padding: 0.75rem var(--spacing-2);
    border-radius: var(--radius-lg);
    border-left: 4px solid var(--color-success-text);
    background-color: var(--color-text-primary);
    color: var(--color-bg-elevated);
    font-size: var(--text-sm);
    font-weight: 500;
    box-shadow: var(--shadow-lg);
  }

  @media (prefers-reduced-motion: reduce) {
    .rail-tab,
    .lead-card {
      transition: none;
    }
  }
</style>
