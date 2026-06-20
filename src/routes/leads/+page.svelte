<script lang="ts">
  import { goto } from '$app/navigation';
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import {
    leadsUi,
    toggleVenue,
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
  // pipeline (spec §8B). A per-venue Import pre-selects that venue; the
  // page-level action omits it so /upload asks which venue first.
  function importPhoto(venueId?: string) {
    goto(venueId ? `/upload?venue=${venueId}` : '/upload');
  }

  // ── Mock store data (spec §11.2) ────────────────────────────────
  // Sub-step 2 builds/verifies the table UI in isolation; real leads get wired
  // in later. Templates cover all 7 statuses + truncation edge cases. The first
  // venue gets rows; the rest stay empty to exercise the §3 empty state.
  const MOCK_TEMPLATES: Omit<Lead, 'id' | 'venueId'>[] = [
    { name: 'Priya Sharma', eventDate: '2026-07-12', eventTime: '7:00 PM', eventType: 'Marriage', phone: '+919876543210', status: 'new', notes: null },
    { name: 'Rajesh Kumar', eventDate: '2026-08-03', eventTime: 'Evening', eventType: 'Reception', phone: '+919812345678', status: 'no_answer', notes: 'Tried twice, no response yet' },
    { name: 'Anjali Mehta', eventDate: '2026-09-15', eventTime: '11:30 AM', eventType: 'Engagement', phone: '+919900112233', status: 'interested', notes: 'Wants a quote for 250 guests' },
    { name: 'Vikram Singh', eventDate: '2026-07-28', eventTime: '6:30 PM', eventType: 'Sangeet', phone: '+919765432100', status: 'quoted', notes: 'Sent the 1.2L package' },
    { name: 'Deepa & Arjun', eventDate: '2026-10-05', eventTime: '12:00 PM', eventType: 'Marriage', phone: '+919811122233', status: 'booked', notes: 'Advance paid' },
    { name: 'Suresh Rao', eventDate: '2026-08-20', eventTime: 'Evening', eventType: 'Birthday', phone: '+919700088899', status: 'not_interested', notes: 'Went with another venue' },
    { name: 'A very long customer name to test truncation', eventDate: '2026-09-30', eventTime: '5:00 PM', eventType: 'Reception', phone: '+919733344455', status: 'callback', notes: 'Call back after Diwali; deciding between two dates and needs to confirm the final guest count with family' }
  ];

  // Seed mock rows once per venue; skip venues already in the store so status
  // edits survive remounts/navigation (the store is the persistent source).
  $effect(() => {
    data.venues.forEach((v, idx) => {
      if (leadsUi.leadsByVenue[v.id] !== undefined) return;
      leadsUi.leadsByVenue[v.id] =
        idx === 0
          ? MOCK_TEMPLATES.map((t, i) => ({ ...t, id: `${v.id}-mock-${i}`, venueId: v.id }))
          : [];
    });
  });

  // Optimistic status change — the single dispatch point (spec §7). No
  // side-effects yet; later this is where e.g. booked → payment overlay branches.
  function handleStatusChange(leadId: string, newStatus: Status) {
    for (const venueId of Object.keys(leadsUi.leadsByVenue)) {
      const arr = leadsUi.leadsByVenue[venueId];
      const idx = arr.findIndex((l) => l.id === leadId);
      if (idx !== -1) {
        arr[idx] = { ...arr[idx], status: newStatus }; // reassign → guaranteed reactive
        return;
      }
    }
  }

  // Showcase dispatch — the single side-effect entry point (spec §6). Delivery is
  // stubbed (a confirmation toast) pending owner answers on how a showcase is sent.
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

  // Svelte JS transitions aren't covered by the global CSS reduced-motion rule,
  // so collapse the toast's motion when the user prefers reduced motion.
  function toastFly() {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { y: reduced ? 0 : 8, duration: reduced ? 0 : 300 };
  }

  // ── Status sort (spec §6 reorder-on-status) ─────────────────────
  // Rows re-sort by status so the most actionable surface at the top;
  // not_interested is pinned at the bottom (it stays visible for now — hiding
  // it is a later planned behaviour). The store keeps insertion order, so equal
  // statuses stay stable and the accordion/scroll position never moves; only
  // the render reorders, and animate:flip tweens it (transform only).
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

  // FLIP animates transform only (motion-rule compliant); disable it under
  // prefers-reduced-motion (the global CSS rule doesn't cover JS animations).
  function flipParams() {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { duration: reduced ? 0 : 300 };
  }

  // ── Cell formatters ─────────────────────────────────────────────
  function dateTime(lead: Lead): string {
    const d = humanDate(lead.eventDate);
    return lead.eventTime ? `${d} · ${lead.eventTime}` : d;
  }

  // +919876543210 -> "+91 98765 43210" for readability; pass through otherwise.
  function prettyPhone(phone: string): string {
    const m = phone.match(/^\+91(\d{5})(\d{5})$/);
    return m ? `+91 ${m[1]} ${m[2]}` : phone;
  }
</script>

<svelte:head><title>Leads · Booking Capture</title></svelte:head>

<div class="leads-container">
  <header class="page-head">
    <h1 class="page-title">Leads</h1>
    <button class="ghost-btn" type="button" onclick={() => importPhoto()}>
      <svg class="ghost-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
      <span>Import photo</span>
    </button>
  </header>

  {#if data.venues.length === 0}
    <p class="no-venues">No venues yet. Add one from the Upload screen to start grouping leads.</p>
  {:else}
    <ul class="venue-list">
      {#each data.venues as v (v.id)}
        {@const open = leadsUi.openVenues[v.id] ?? false}
        {@const venueLeads = sortLeads(leadsUi.leadsByVenue[v.id] ?? [])}
        <li class="venue-card">
          <div class="venue-head">
            <button
              class="venue-toggle"
              type="button"
              aria-expanded={open}
              aria-controls={`venue-panel-${v.id}`}
              onclick={() => toggleVenue(v.id)}
            >
              <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
              <span class="venue-name">{v.name}</span>
              <span class="count-badge">
                {v.count}
                {#if v.followUps > 0}
                  <span class="count-followups">· {v.followUps} follow-up{v.followUps === 1 ? '' : 's'}</span>
                {/if}
              </span>
            </button>

            <button
              class="ghost-btn import-venue"
              type="button"
              aria-label={`Import leads for ${v.name} from photo`}
              onclick={(e) => {
                e.stopPropagation();
                importPhoto(v.id);
              }}
            >
              <svg class="ghost-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              <span class="import-label">Import</span>
            </button>
          </div>

          <div
            class="venue-panel"
            id={`venue-panel-${v.id}`}
            role="region"
            aria-label={`${v.name} leads`}
            data-open={open ? 'true' : 'false'}
          >
            <div class="panel-inner">
              <div class="panel-content">
                {#if venueLeads.length === 0}
                  <div class="leads-empty">
                    <svg class="leads-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                    </svg>
                    <p class="leads-empty-text">No leads yet for this venue.</p>
                    <button class="ghost-btn" type="button" onclick={() => importPhoto()}>Import from photo</button>
                  </div>
                {:else}
                  <div class="leads-table-scroll">
                    <table class="leads-table">
                      <thead>
                        <tr>
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
                        {#each venueLeads as lead (lead.id)}
                          <tr class="lead-row" class:is-new={lead.isNew} animate:flip={flipParams()}>
                            <td class="col-name"><span class="cell-name">{lead.name}</span></td>
                            <td class="col-datetime cell-datetime">{dateTime(lead)}</td>
                            <td class="col-type cell-type">{lead.eventType}</td>
                            <td class="col-phone">
                              <a class="cell-phone" href={telLink(lead.phone)}>{prettyPhone(lead.phone)}</a>
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
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if toast}
  <div class="toast" role="status" transition:fly={toastFly()}>
    {toast}
  </div>
{/if}

<style>
  /* §1 — single centered column. Horizontal padding comes from the layout's
     .container-app shell, so this only caps width (1120) and adds vertical rhythm. */
  .leads-container {
    width: 100%;
    max-width: 1120px;
    margin-inline: auto;
    padding-block: var(--spacing-3);
  }

  .page-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-3);
  }
  .page-title {
    font-size: var(--text-2xl);
    font-weight: 600;
    line-height: var(--leading-snug);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text-primary);
  }

  /* Ghost action (§8) — page-level + per-venue Import, and the empty-state CTA. */
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
      color var(--duration-short) var(--ease-standard),
      background-color var(--duration-short) var(--ease-standard);
  }
  .ghost-btn:hover {
    color: var(--color-accent-text);
    background-color: var(--color-bg-sunken);
  }
  .ghost-icon {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }

  /* ── Tier 1: venue accordion (§2) ──────────────────────────────── */
  .venue-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    list-style: none;
  }
  .venue-card {
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border-base);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xs);
    overflow: hidden; /* clean rounded corners; why popovers must portal out later */
  }

  .venue-head {
    display: flex;
    align-items: center;
    min-height: 64px;
  }

  .venue-toggle {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    min-height: 64px;
    padding-inline: var(--spacing-2);
    text-align: left;
    appearance: none;
    border: 0;
    font: inherit;
    color: inherit;
    background-color: transparent;
    cursor: pointer;
    transition: background-color var(--duration-short) var(--ease-standard);
  }
  .venue-toggle:hover {
    background-color: var(--color-bg-sunken);
  }

  .chevron {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
    color: var(--color-text-tertiary);
    transition: transform var(--duration-base) var(--ease-standard);
  }
  [aria-expanded='true'] .chevron {
    transform: rotate(180deg);
  }

  .venue-name {
    font-size: var(--text-xl);
    font-weight: 600;
    letter-spacing: var(--tracking-tight);
    color: var(--color-text-primary);
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    height: 1.5rem;
    padding-inline: var(--spacing-1);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    background-color: var(--color-bg-sunken);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
  .count-followups {
    margin-inline-start: var(--spacing-0h);
    color: var(--color-status-callback-text);
  }

  .import-venue {
    margin-inline-end: var(--spacing-1);
  }

  /* Chevron + expand (§2, verbatim) */
  .venue-panel {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows var(--duration-base) var(--ease-standard);
  }
  .venue-panel > .panel-inner {
    overflow: hidden;
  }
  .venue-panel[data-open='true'] {
    grid-template-rows: 1fr;
  }
  .panel-inner {
    opacity: 0;
    transition: opacity var(--duration-short) var(--ease-enter);
  }
  .venue-panel[data-open='true'] .panel-inner {
    opacity: 1;
  }

  .panel-content {
    border-top: 1px solid var(--color-border-base);
  }

  .no-venues {
    font-size: var(--text-sm);
    color: var(--color-text-tertiary);
  }

  /* Toast — interim confirmation for the stubbed showcase dispatch (design-system
     §toast): inverted surface, green success border, sits above the tab bar. */
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
    border-left: 4px solid var(--color-status-booked-text);
    background-color: var(--color-text-primary);
    color: var(--color-bg-elevated);
    font-size: var(--text-sm);
    font-weight: 500;
    box-shadow: var(--shadow-lg);
  }

  /* ── Per-venue empty state (§3) ────────────────────────────────── */
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

  /* ── Tier 2: leads table (§3) ──────────────────────────────────── */
  .leads-table-scroll {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }
  .leads-table {
    width: 100%;
    min-width: 911px; /* sum of fixed column widths — scrolls below ~md (§4) */
    table-layout: fixed; /* enforce column widths so the frozen Name can't dominate */
    border-collapse: separate; /* sticky frozen columns need separate borders */
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
    height: 72px; /* §3 clamp — single line; never taller, prevents jitter */
    transition: background-color var(--duration-short) var(--ease-standard);
  }
  .lead-row:hover {
    background-color: var(--color-bg-sunken);
  }
  /* Freshly imported rows (§8B): a brief accent highlight that settles to
     the normal row bg. Plays once on insert; reduced-motion disables it. */
  .lead-row.is-new {
    animation: lead-row-new var(--duration-long) var(--ease-enter);
  }
  @keyframes lead-row-new {
    from {
      background-color: var(--color-accent-subtle);
    }
    to {
      background-color: transparent;
    }
  }
  .leads-table td {
    padding: var(--spacing-1) var(--spacing-2);
    vertical-align: middle;
  }
  /* Row separators on cells (separate border model doesn't paint <tr> borders). */
  .leads-table tbody td {
    border-top: 1px solid var(--color-border-base);
  }

  /* Columns */
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
    font-variant-numeric: tabular-nums;
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
    font-variant-numeric: tabular-nums;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
  .cell-phone:hover {
    color: var(--color-accent-text);
  }

  /* Fixed-width status column prevents column jitter (§3 / §9). */
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

  /* ── Below md: same table, horizontal scroll + frozen identity columns (§4) ── */
  @media (max-width: 767px) {
    .col-name {
      position: sticky;
      left: 0;
      z-index: 1;
    }

    /* Body frozen cell needs an opaque bg so scrolled content doesn't bleed
       through; it must track the row hover bg or it'll look detached. */
    .leads-table tbody .col-name {
      background-color: var(--color-bg-elevated);
    }
    .lead-row:hover .col-name {
      background-color: var(--color-bg-sunken);
    }

    /* Header frozen cell keeps the header band bg and sits above the rest. */
    .leads-table thead .col-name {
      z-index: 2;
    }

    /* Edge shadow on the frozen Name column — affords "more content to the right". */
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

  @media (prefers-reduced-motion: reduce) {
    .venue-panel,
    .panel-inner,
    .chevron,
    .lead-row {
      transition: none;
    }
  }
</style>
