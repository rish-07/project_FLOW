<script lang="ts">
  import { goto } from '$app/navigation';
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
  import { humanDate, telLink } from '$lib/utils';
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

  // ── Mock store data (interim, pending real wiring) ──────────────────────
  const MOCK_TEMPLATES: Omit<Lead, 'id' | 'venueId'>[] = [
    { name: 'Priya Sharma', eventDate: '2026-07-12', eventTime: '7:00 PM', eventType: 'Marriage', phone: '+919876543210', status: 'new', notes: null },
    { name: 'Rajesh Kumar', eventDate: '2026-08-03', eventTime: 'Evening', eventType: 'Reception', phone: '+919812345678', status: 'no_answer', notes: 'Tried twice, no response yet' },
    { name: 'Anjali Mehta', eventDate: '2026-09-15', eventTime: '11:30 AM', eventType: 'Engagement', phone: '+919900112233', status: 'interested', notes: 'Wants a quote for 250 guests' },
    { name: 'Vikram Singh', eventDate: '2026-07-28', eventTime: '6:30 PM', eventType: 'Sangeet', phone: '+919765432100', status: 'quoted', notes: 'Sent the 1.2L package' },
    { name: 'Deepa & Arjun', eventDate: '2026-10-05', eventTime: '12:00 PM', eventType: 'Marriage', phone: '+919811122233', status: 'booked', notes: 'Advance paid' },
    { name: 'Suresh Rao', eventDate: '2026-08-20', eventTime: 'Evening', eventType: 'Birthday', phone: '+919700088899', status: 'not_interested', notes: 'Went with another venue' },
    { name: 'A very long customer name to test truncation', eventDate: '2026-09-30', eventTime: '5:00 PM', eventType: 'Reception', phone: '+919733344455', status: 'callback', notes: 'Call back after Diwali; deciding between two dates and needs to confirm the final guest count with family' }
  ];

  // Rail order: most urgent first (follow-ups due, then lead count) — the
  // asymmetry encodes priority, not just available space (design-system.md §4).
  const rankedVenues = $derived(
    [...data.venues].sort((a, b) => b.followUps - a.followUps || b.count - a.count)
  );

  // Seed mock rows once per venue; skip venues already in the store. Default
  // the active venue to the most urgent one once data is available.
  $effect(() => {
    data.venues.forEach((v, idx) => {
      if (leadsUi.leadsByVenue[v.id] !== undefined) return;
      leadsUi.leadsByVenue[v.id] =
        idx === 0
          ? MOCK_TEMPLATES.map((t, i) => ({ ...t, id: `${v.id}-mock-${i}`, venueId: v.id }))
          : [];
    });
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

  function handleStatusChange(leadId: string, newStatus: Status) {
    for (const venueId of Object.keys(leadsUi.leadsByVenue)) {
      const arr = leadsUi.leadsByVenue[venueId];
      const idx = arr.findIndex((l) => l.id === leadId);
      if (idx !== -1) {
        arr[idx] = { ...arr[idx], status: newStatus };
        return;
      }
    }
  }

  let toast = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

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

  function dateTime(lead: Lead): string {
    const d = humanDate(lead.eventDate);
    return lead.eventTime ? `${d} · ${lead.eventTime}` : d;
  }

  function prettyPhone(phone: string): string {
    const m = phone.match(/^\+91(\d{5})(\d{5})$/);
    return m ? `+91 ${m[1]} ${m[2]}` : phone;
  }
</script>

<svelte:head><title>Leads · Booking Capture</title></svelte:head>

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
              <button type="button" class="import-link" onclick={() => importPhoto(activeVenue.id)}>
                Import photo
              </button>
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
              <div class="leads-table-scroll">
                <table class="leads-table">
                  <thead>
                    <tr>
                      <th class="col-num" scope="col">#</th>
                      <th class="col-name" scope="col">Name</th>
                      <th class="col-datetime" scope="col">Date &amp; Time</th>
                      <th class="col-type" scope="col">Event type</th>
                      <th class="col-phone" scope="col">Phone</th>
                      <th class="col-status" scope="col">Status</th>
                      <th class="col-notes" scope="col">Notes</th>
                      <th class="col-send" scope="col">Send</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each activeVenueLeads as lead, i (lead.id)}
                      <tr class="lead-row" class:is-new={lead.isNew} animate:flip={flipParams()}>
                        <td class="col-num cell-num tabular">{String(i + 1).padStart(2, '0')}</td>
                        <td class="col-name"><span class="cell-name" title={lead.name}>{lead.name}</span></td>
                        <td class="col-datetime cell-datetime tabular">{dateTime(lead)}</td>
                        <td class="col-type cell-type" title={lead.eventType}>{lead.eventType}</td>
                        <td class="col-phone">
                          <a class="cell-phone tabular" href={telLink(lead.phone)}>{prettyPhone(lead.phone)}</a>
                        </td>
                        <td class="col-status">
                          <StatusPill
                            leadId={lead.id}
                            status={lead.status}
                            name={lead.name}
                            onStatusChange={handleStatusChange}
                          />
                        </td>
                        <td class="col-notes">
                          <span class="cell-notes" title={lead.notes ?? ''}>{lead.notes ?? '—'}</span>
                        </td>
                        <td class="col-send">
                          <SendMenu leadId={lead.id} name={lead.name} onSendShowcase={handleSendShowcase} />
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        {/key}
      {/if}
    </div>
  {/if}
</div>

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
  .spread-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-2) var(--spacing-2);
    border-bottom: 1px solid var(--color-border-base);
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

  /* ── Ledger table ─────────────────────────────────────────────────────── */
  .leads-table-scroll {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }
  .leads-table {
    width: 100%;
    min-width: 950px;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0;
  }

  .leads-table thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: var(--spacing-1) var(--spacing-2);
    text-align: left;
    font-size: var(--text-2xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-tertiary);
    background-color: var(--color-bg-sunken);
    white-space: nowrap;
  }

  .lead-row {
    height: 72px;
    transition: background-color var(--duration-base) var(--ease-premium);
  }
  .lead-row:hover {
    background-color: var(--color-bg-sunken);
  }
  .lead-row.is-new {
    animation: lead-row-new var(--duration-long) var(--ease-enter);
  }
  @keyframes lead-row-new {
    from { background-color: var(--color-accent-subtle); }
    to   { background-color: transparent; }
  }
  .leads-table td {
    padding: var(--spacing-1) var(--spacing-2);
    vertical-align: middle;
  }
  .leads-table tbody td {
    border-top: 1px solid var(--color-border-base);
  }

  /* Ledger line-number column — the structural callback to the metaphor. */
  .col-num {
    width: 40px;
  }
  .cell-num {
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
  }

  .col-name {
    width: 150px;
  }
  .cell-name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .col-datetime {
    width: 175px;
  }
  .cell-datetime {
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
  .col-type {
    width: 110px;
  }
  .cell-type {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .col-phone {
    width: 150px;
    text-align: right;
  }
  .cell-phone {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
    transition: color var(--duration-base) var(--ease-premium);
  }
  .cell-phone:hover {
    color: var(--color-accent-text);
  }

  .col-status {
    width: 120px;
  }

  .col-notes {
    width: 150px;
  }
  .cell-notes {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .col-send {
    width: 56px;
    text-align: center;
  }

  /* ── Below md: frozen identity columns on horizontal scroll ────────────── */
  @media (max-width: 767px) {
    .col-name {
      position: sticky;
      left: 40px;
      z-index: 1;
    }
    .col-num {
      position: sticky;
      left: 0;
      z-index: 1;
    }
    .leads-table tbody .col-name,
    .leads-table tbody .col-num {
      background-color: var(--color-bg-elevated);
    }
    .lead-row:hover .col-name,
    .lead-row:hover .col-num {
      background-color: var(--color-bg-sunken);
    }
    .leads-table thead .col-name,
    .leads-table thead .col-num {
      z-index: 2;
    }
    .col-name::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 8px;
      transform: translateX(100%);
      background: linear-gradient(to right, var(--color-border-base), transparent);
      pointer-events: none;
    }
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
    bottom: calc(var(--tab-bar-height) + env(safe-area-inset-bottom, 0px) + var(--spacing-2));
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
    .lead-row {
      transition: none;
    }
  }
</style>
