<script lang="ts">
  import { enhance } from '$app/forms';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ZoomableImage from '$lib/components/ZoomableImage.svelte';
  import { LOW_CONFIDENCE, isValidPhone, type Confidence } from '$lib/utils';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const EVENT_TYPES = ['Marriage', 'Engagement', 'Reception', 'Sangeet', 'Birthday', 'Other'];

  type Card = {
    id: string;
    customerName: string;
    eventType: string;
    eventDate: string;
    eventSlot: 'AM' | 'PM';
    phonePrimary: string;
    phoneSecondary: string;
    notes: string;
    sourceImageKey: string | null;
    confidence: Confidence | null;
  };

  let cards = $state<Card[]>([]);
  let saving = $state(false);
  let hydrated = false;

  // Clone the loaded leads into editable state once. The page only reloads via
  // save (which redirects away), so a one-time hydrate is correct — and we must
  // not re-clone after she deletes cards.
  $effect(() => {
    if (!hydrated) {
      hydrated = true;
      // Narrow the slot to the AM/PM union the toggle binds to.
      cards = data.leads.map((l) => ({ ...l, eventSlot: l.eventSlot === 'PM' ? 'PM' : 'AM' }));
    }
  });

  // What gets sent to the save action: the kept cards, minus display-only fields.
  const payload = $derived(
    JSON.stringify(
      cards.map(({ confidence, sourceImageKey, ...rest }) => rest)
    )
  );

  function removeCard(id: string) {
    cards = cards.filter((c) => c.id !== id);
  }

  function lowConfidence(c: Card, field: keyof Confidence): boolean {
    return !!c.confidence && c.confidence[field] < LOW_CONFIDENCE;
  }

  // Phones get an extra, live signal: flag whenever the current value can't be
  // read as a clean 10-digit number (primary is required; secondary only if set).
  function primaryBad(c: Card): boolean {
    return !isValidPhone(c.phonePrimary);
  }
  function secondaryBad(c: Card): boolean {
    return c.phoneSecondary.trim() !== '' && !isValidPhone(c.phoneSecondary);
  }
</script>

<svelte:head><title>Confirm bookings · Booking Capture</title></svelte:head>

{#snippet warnChip()}
  <span class="chip-warn">
    <svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
    Double-check
  </span>
{/snippet}

{#if data.leads.length === 0}
  <EmptyState
    overline="Step 2"
    title="Nothing to confirm"
    description="This upload has no pending bookings — it may already be saved. Start a new one from Upload."
  >
    <svg slot="icon" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
    <a slot="action" class="btn-primary" href="/upload">Go to Upload</a>
  </EmptyState>
{:else}
  <div class="confirm-screen">
    <header class="intro">
      <p class="overline">Step 2 · Confirm</p>
      <h1 class="intro-title">Check each booking</h1>
      <p class="intro-sub">Fix anything flagged for a double-check, remove misreads, then save.</p>
    </header>

    <ul class="card-list">
      {#each cards as c, i (c.id)}
        <li class="card">
          <div class="card-head">
            <span class="card-index">Booking {i + 1}</span>
            <button type="button" class="remove-btn" aria-label={`Remove booking ${i + 1}`} onclick={() => removeCard(c.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {#if c.sourceImageKey}
            <div class="card-photo">
              <ZoomableImage
                src={`/api/photos/${c.sourceImageKey}`}
                alt={`Diary page for booking ${i + 1}`}
              />
            </div>
          {/if}

          <div class="fields">
            <div class="field field-full">
              <span class="field-label">Customer name {#if lowConfidence(c, 'customer_name')}{@render warnChip()}{/if}</span>
              <input class="input-field" type="text" bind:value={c.customerName} />
            </div>

            <div class="field">
              <span class="field-label">Event type {#if lowConfidence(c, 'event_type')}{@render warnChip()}{/if}</span>
              <select class="input-field" bind:value={c.eventType}>
                {#if c.eventType && !EVENT_TYPES.includes(c.eventType)}
                  <option value={c.eventType}>{c.eventType}</option>
                {/if}
                {#each EVENT_TYPES as t}
                  <option value={t}>{t}</option>
                {/each}
              </select>
            </div>

            <div class="field">
              <span class="field-label">Event date {#if lowConfidence(c, 'event_date')}{@render warnChip()}{/if}</span>
              <input class="input-field" type="date" bind:value={c.eventDate} />
            </div>

            <div class="field">
              <span class="field-label">Event slot {#if lowConfidence(c, 'event_slot')}{@render warnChip()}{/if}</span>
              <div
                class="slot-toggle"
                class:flagged={lowConfidence(c, 'event_slot')}
                role="radiogroup"
                aria-label={`Event slot for booking ${i + 1}`}
              >
                <button
                  type="button"
                  role="radio"
                  class="slot-opt"
                  class:active={c.eventSlot === 'AM'}
                  aria-checked={c.eventSlot === 'AM'}
                  onclick={() => (c.eventSlot = 'AM')}
                >
                  AM
                </button>
                <button
                  type="button"
                  role="radio"
                  class="slot-opt"
                  class:active={c.eventSlot === 'PM'}
                  aria-checked={c.eventSlot === 'PM'}
                  onclick={() => (c.eventSlot = 'PM')}
                >
                  PM
                </button>
              </div>
            </div>

            <div class="field">
              <span class="field-label">Primary phone {#if lowConfidence(c, 'phone_primary') || primaryBad(c)}{@render warnChip()}{/if}</span>
              <input class="input-field tabular" type="tel" inputmode="tel" bind:value={c.phonePrimary} />
              {#if primaryBad(c)}
                <p class="field-error">Doesn't look like a 10-digit number — please check.</p>
              {/if}
            </div>

            <div class="field">
              <span class="field-label">Second phone <span class="optional">(optional)</span> {#if lowConfidence(c, 'phone_secondary') || secondaryBad(c)}{@render warnChip()}{/if}</span>
              <input class="input-field tabular" type="tel" inputmode="tel" bind:value={c.phoneSecondary} />
              {#if secondaryBad(c)}
                <p class="field-error">Doesn't look like a 10-digit number — please check.</p>
              {/if}
            </div>

            <div class="field field-full">
              <span class="field-label">Notes <span class="optional">(optional)</span></span>
              <textarea class="input-field textarea" rows="2" bind:value={c.notes}></textarea>
            </div>
          </div>
        </li>
      {/each}
    </ul>

    {#if cards.length === 0}
      <p class="all-removed">You've removed every booking. Keep at least one to save, or head back to Upload.</p>
    {/if}

    <form
      class="save-bar"
      method="POST"
      action="?/save"
      use:enhance={() => {
        saving = true;
        return async ({ update }) => {
          await update();
          saving = false;
        };
      }}
    >
      <input type="hidden" name="session_id" value={data.sessionId} />
      <input type="hidden" name="payload" value={payload} />

      {#if form?.error}
        <p class="save-error" role="alert">{form.error}</p>
      {/if}

      <button class="btn-primary save-cta" type="submit" disabled={saving || cards.length === 0}>
        {saving ? 'Saving…' : `Save ${cards.length} booking${cards.length === 1 ? '' : 's'}`}
      </button>
    </form>
  </div>
{/if}

<style>
  .confirm-screen {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  /* Each booking's own source page, shown above its fields for cross-checking. */
  .card-photo {
    margin-bottom: var(--spacing-2);
  }

  .intro-title {
    font-size: var(--text-xl);
    font-weight: 600;
    line-height: var(--leading-snug);
    color: var(--color-text-primary);
  }
  .intro-sub {
    margin-top: var(--spacing-0h);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  /* ── Cards ─────────────────────────────────────────────────────── */
  .card-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    list-style: none;
  }
  .card {
    padding: var(--spacing-2);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border-base);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xs);
  }
  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-2);
  }
  .card-index {
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--color-text-tertiary);
  }
  .remove-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    margin: -6px;
    border-radius: var(--radius-md);
    color: var(--color-text-tertiary);
    transition:
      color var(--duration-short) var(--ease-standard),
      background-color var(--duration-short) var(--ease-standard);
  }
  .remove-btn svg {
    width: 1.125rem;
    height: 1.125rem;
  }
  .remove-btn:hover {
    color: var(--color-danger-text);
    background-color: var(--color-danger-bg);
  }

  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-2);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }
  .field-full {
    grid-column: 1 / -1;
  }
  .field-label {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-1);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
  }
  .optional {
    font-weight: 400;
    color: var(--color-text-tertiary);
  }
  .field-error {
    font-size: var(--text-xs);
    color: var(--color-warning-text);
  }
  .textarea {
    height: auto;
    min-height: 48px;
    padding-block: var(--spacing-1);
    resize: vertical;
    line-height: var(--leading-normal);
  }

  /* ── AM/PM slot toggle (replaces the free-text time input) ─────── */
  .slot-toggle {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px;
    height: 48px;
    padding: 3px;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-elevated);
    transition: border-color var(--duration-base) var(--ease-premium);
  }
  /* Amber when event_slot confidence is low — mirrors the warn chip. */
  .slot-toggle.flagged {
    border-color: var(--color-warning-icon);
    background-color: var(--color-warning-bg);
  }
  .slot-opt {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-secondary);
    background-color: transparent;
    cursor: pointer;
    transition:
      color var(--duration-base) var(--ease-premium),
      background-color var(--duration-base) var(--ease-premium);
  }
  .slot-opt:hover:not(.active) {
    color: var(--color-text-primary);
  }
  .slot-opt.active {
    color: var(--color-accent-text);
    background-color: var(--color-accent-subtle);
  }

  /* ── Amber double-check chip (§3 / §5) ─────────────────────────── */
  .chip-warn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-0h);
    padding: 0.125rem var(--spacing-1);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-warning-text);
    background-color: var(--color-warning-bg);
  }
  .chip-icon {
    width: 0.75rem;
    height: 0.75rem;
    color: var(--color-warning-icon);
  }

  /* ── Sticky save bar (above the tab bar) ───────────────────────── */
  .save-bar {
    position: sticky;
    /* Sit above the floating nav pill (fixed at the viewport bottom) so the
       save CTA is never hidden behind it. */
    bottom: calc(env(safe-area-inset-bottom, 0px) + 5rem);
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
    padding-top: var(--spacing-2);
    background: linear-gradient(to top, var(--color-bg-base) 78%, transparent);
  }
  .save-error {
    font-size: var(--text-sm);
    color: var(--color-danger-text);
    background-color: var(--color-danger-bg);
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-md);
  }
  .save-cta {
    width: 100%;
  }
  .all-removed {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    text-align: center;
  }
</style>
