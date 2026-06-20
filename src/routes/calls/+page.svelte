<script lang="ts">
  import { slide } from 'svelte/transition';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import {
    humanDate,
    telLink,
    whatsappLink,
    todayISO,
    STATUS_LABELS
  } from '$lib/utils';
  import type { Status } from '$lib/stores/leads.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type Call = {
    id: string;
    customerName: string;
    eventType: string;
    eventDate: string;
    phonePrimary: string;
    status: Status;
    nextFollowupOn: string | null;
    venueName: string;
  };

  // Local worklist — a fresh copy of the loaded list so items can leave
  // optimistically when their new status no longer qualifies. Seeded in a
  // pre-effect (runs before paint, so the empty state never flashes) that
  // re-runs on each fresh `load` when re-entering the tab.
  let items = $state<Call[]>([]);
  $effect.pre(() => {
    items = data.calls.map((c) => ({ ...c, status: c.status as Status }));
  });

  // The quick status row (brief §9): one tap each, border-only at rest.
  const QUICK: { status: Status; label: string }[] = [
    { status: 'no_answer', label: 'No answer' },
    { status: 'interested', label: 'Interested' },
    { status: 'booked', label: 'Booked' },
    { status: 'not_interested', label: 'Not interested' },
    { status: 'callback', label: 'Callback' }
  ];
  const STATUS_TOKEN: Record<Status, string> = {
    new: 'new',
    no_answer: 'no-answer',
    interested: 'interested',
    quoted: 'quoted',
    booked: 'booked',
    not_interested: 'not-int',
    callback: 'callback'
  };
  function tokenVars(s: Status): string {
    const t = STATUS_TOKEN[s];
    return `--pill-bg: var(--color-status-${t}-bg); --pill-text: var(--color-status-${t}-text);`;
  }

  const today = todayISO();

  // A lead stays on today's worklist while it still needs a call: status in
  // {new, no_answer, callback} and any follow-up date is today or earlier.
  function qualifies(c: Call): boolean {
    const inSet = c.status === 'new' || c.status === 'no_answer' || c.status === 'callback';
    return inSet && (!c.nextFollowupOn || c.nextFollowupOn <= today);
  }

  let flashId = $state<string | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | undefined;
  let toast = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  function showToast(msg: string) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 3000);
  }

  // Persist a field change, optimistically. On failure, revert and warn.
  async function patch(c: Call, body: Record<string, unknown>, prev: Partial<Call>) {
    try {
      const res = await fetch(`/api/leads/${c.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error();
      flashSaved(c.id);
      maybeRemove(c.id);
    } catch {
      const i = items.findIndex((x) => x.id === c.id);
      if (i !== -1) items[i] = { ...items[i], ...prev };
      showToast("Couldn't save — check your connection.");
    }
  }

  function flashSaved(id: string) {
    flashId = id;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (flashId = null), 1500);
  }

  // Drop the card once its (saved) state no longer belongs on today's list.
  function maybeRemove(id: string) {
    const c = items.find((x) => x.id === id);
    if (c && !qualifies(c)) items = items.filter((x) => x.id !== id);
  }

  function setStatus(c: Call, status: Status) {
    if (c.status === status && status !== 'callback') return;
    const i = items.findIndex((x) => x.id === c.id);
    if (i === -1) return;
    const prev = { status: c.status, nextFollowupOn: c.nextFollowupOn };
    // Choosing a status other than callback clears any pending follow-up date.
    const nextFollowupOn = status === 'callback' ? c.nextFollowupOn : null;
    items[i] = { ...items[i], status, nextFollowupOn };
    patch(items[i], { status, nextFollowupOn }, prev);
  }

  function setFollowup(c: Call, date: string) {
    const i = items.findIndex((x) => x.id === c.id);
    if (i === -1) return;
    const prev = { nextFollowupOn: c.nextFollowupOn };
    items[i] = { ...items[i], nextFollowupOn: date || null };
    patch(items[i], { nextFollowupOn: date || null }, prev);
  }

  // Calling also stamps last_contacted_at (brief §9). Fire-and-forget — the
  // tel: link must not wait on the network.
  function onCall(c: Call) {
    fetch(`/api/leads/${c.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lastContactedAt: true })
    }).catch(() => {});
  }

  // Svelte JS transitions aren't covered by the global CSS reduced-motion rule.
  function slideParams() {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { duration: reduced ? 0 : 250 };
  }
</script>

<svelte:head><title>Calls · Booking Capture</title></svelte:head>

{#if items.length === 0}
  <EmptyState
    overline="Today"
    title="You're all caught up"
    description="Follow-ups due today appear here — prioritised and ready to dial. Nothing's pending right now."
  >
    <svg slot="icon" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  </EmptyState>
{:else}
  <div class="calls-container">
    <header class="page-head">
      <p class="overline">Today</p>
      <h1 class="page-title">Calls</h1>
      <p class="count">{items.length} to follow up</p>
    </header>

    <ul class="call-list">
      {#each items as c (c.id)}
        <li class="card" transition:slide={slideParams()}>
          <div class="info">
            <p class="name">{c.customerName}</p>
            <p class="meta">
              <span>{c.eventType}</span>
              <span class="dot-sep" aria-hidden="true">·</span>
              <span class="tabular">{humanDate(c.eventDate)}</span>
              <span class="dot-sep" aria-hidden="true">·</span>
              <span class="venue">{c.venueName}</span>
            </p>
          </div>

          <div class="actions">
            <a
              class="big-btn call"
              href={telLink(c.phonePrimary)}
              onclick={() => onCall(c)}
              aria-label={`Call ${c.customerName}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
              <span>Call</span>
            </a>
            <a
              class="big-btn whatsapp"
              href={whatsappLink(c.phonePrimary)}
              target="_blank"
              rel="noopener"
              aria-label={`WhatsApp ${c.customerName}`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.14c-.24.68-1.42 1.32-1.95 1.36-.5.04-.97.22-3.27-.68-2.76-1.09-4.5-3.92-4.64-4.1-.13-.18-1.1-1.47-1.1-2.8 0-1.33.7-1.98.94-2.25.24-.27.53-.34.71-.34.18 0 .35 0 .51.01.16.01.39-.06.6.46.24.57.82 1.96.89 2.1.07.14.12.3.02.48-.09.18-.14.29-.28.45-.14.16-.3.36-.42.48-.14.14-.29.29-.12.57.16.27.73 1.2 1.56 1.95 1.07.96 1.97 1.25 2.25 1.39.27.14.43.12.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.23.6-.14.24.09 1.55.73 1.81.86.27.13.45.2.51.31.07.11.07.64-.17 1.32Z" />
              </svg>
              <span>WhatsApp</span>
            </a>
          </div>

          <div class="status-row" role="group" aria-label={`Update status for ${c.customerName}`}>
            {#each QUICK as q (q.status)}
              <button
                class="quick"
                class:active={c.status === q.status}
                type="button"
                style={tokenVars(q.status)}
                aria-pressed={c.status === q.status}
                onclick={() => setStatus(c, q.status)}
              >
                {q.label}
              </button>
            {/each}
          </div>

          {#if c.status === 'callback'}
            <div class="callback-row" transition:slide={slideParams()}>
              <label for={`fu-${c.id}`}>Call back on</label>
              <input
                id={`fu-${c.id}`}
                class="date-input tabular"
                type="date"
                min={today}
                value={c.nextFollowupOn ?? ''}
                onchange={(e) => setFollowup(c, e.currentTarget.value)}
              />
            </div>
          {/if}

          {#if flashId === c.id}
            <span class="saved" transition:slide={slideParams()} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.75 6 6 9-13.5" /></svg>
              Saved
            </span>
          {/if}

          <span class="sr-only" aria-live="polite">
            {flashId === c.id ? `Status set to ${STATUS_LABELS[c.status]}` : ''}
          </span>
        </li>
      {/each}
    </ul>
  </div>
{/if}

{#if toast}
  <div class="toast" role="status" transition:slide={slideParams()}>{toast}</div>
{/if}

<style>
  /* WhatsApp brand green is spec-mandated (design-system §9 names #22C55E
     explicitly); no @theme token exists for it, so scope it here, once. */
  .whatsapp {
    --wa-green: #22c55e;
    --wa-green-hover: #16a34a;
  }

  .calls-container {
    width: 100%;
    max-width: 640px;
    margin-inline: auto;
    padding-block: var(--spacing-3);
  }

  .page-head {
    margin-bottom: var(--spacing-3);
  }
  .page-title {
    font-size: var(--text-2xl);
    font-weight: 600;
    line-height: var(--leading-snug);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text-primary);
  }
  .count {
    margin-top: var(--spacing-0h);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .call-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  /* Card (§9): stacked, full-width, p-4. */
  .card {
    padding: var(--spacing-2);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border-base);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xs);
  }

  .info {
    margin-bottom: var(--spacing-2);
  }
  .name {
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: var(--leading-snug);
    color: var(--color-text-primary);
  }
  .meta {
    margin-top: var(--spacing-0h);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-1);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
  .dot-sep {
    color: var(--color-text-tertiary);
  }
  .venue {
    color: var(--color-text-tertiary);
  }

  /* Two hero tap-targets (§9): side by side, 52px, flex 1. */
  .actions {
    display: flex;
    gap: var(--spacing-1);
  }
  .big-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-1);
    height: 52px;
    border-radius: var(--radius-md);
    font-size: 0.9375rem;
    font-weight: 600;
    transition:
      background-color var(--duration-short) var(--ease-standard),
      transform var(--duration-fast) var(--ease-spring);
  }
  .big-btn:active {
    transform: scale(0.98);
  }
  .big-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }
  .call {
    background-color: var(--color-accent);
    color: var(--color-text-inverse);
  }
  .call:hover {
    background-color: var(--color-accent-hover);
  }
  .whatsapp {
    background-color: var(--wa-green);
    color: #ffffff;
  }
  .whatsapp:hover {
    background-color: var(--wa-green-hover);
  }

  /* Quick status row (§9): small pills, border-only at rest, fill on active. */
  .status-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-1);
    margin-top: var(--spacing-2);
  }
  .quick {
    height: 36px;
    padding-inline: var(--spacing-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    background-color: transparent;
    cursor: pointer;
    transition:
      color var(--duration-short) var(--ease-standard),
      background-color var(--duration-short) var(--ease-standard),
      border-color var(--duration-short) var(--ease-standard);
  }
  .quick:hover {
    color: var(--color-text-primary);
    background-color: var(--color-bg-sunken);
  }
  .quick.active {
    color: var(--pill-text);
    background-color: var(--pill-bg);
    border-color: transparent;
  }

  .callback-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-top: var(--spacing-2);
  }
  .callback-row label {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
  .date-input {
    height: 44px;
    padding-inline: var(--spacing-2);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    color-scheme: light dark;
  }
  .date-input:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-subtle);
  }

  .saved {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-0h);
    margin-top: var(--spacing-2);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-success-text);
  }
  .saved svg {
    width: 0.875rem;
    height: 0.875rem;
  }

  .toast {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--tab-bar-height) + env(safe-area-inset-bottom, 0px) + var(--spacing-2));
    z-index: 70;
    padding: var(--spacing-1) var(--spacing-2);
    background-color: var(--color-text-primary);
    color: var(--color-bg-elevated);
    border-left: 3px solid var(--color-danger-text);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    box-shadow: var(--shadow-lg);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
