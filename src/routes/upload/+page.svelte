<script lang="ts">
  import { onDestroy } from 'svelte';
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { fade } from 'svelte/transition';
  import { takePendingUpload } from '$lib/stores/pendingUpload.svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  type ExtractResponse = { session_id?: string; count?: number; message?: string };
  type Status = 'staged' | 'queued' | 'processing' | 'success' | 'failed';
  type StagedPage = {
    id: string;
    file: File;
    previewUrl: string;
    status: Status;
    count: number;
    error: string;
  };

  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — mirrors the server guard.
  const POOL = 3; // concurrent extract calls — gentle on Gemini.
  // A hung request must become a failed item, never a permanent "Reading…".
  // Without this, one stalled fetch would block the loop forever.
  const REQUEST_TIMEOUT_MS = 60_000;

  type ProcessMode = 'concurrent' | 'sequential';

  let pages = $state<StagedPage[]>([]);
  let venueId = $state('');
  let addOpen = $state(false);
  let dragging = $state(false);
  // How the batch is read: a concurrency pool (default — faster) or one page at
  // a time. User-switchable below; locked while a run is in flight.
  let processMode = $state<ProcessMode>('concurrent');
  let noticeMsg = $state(''); // skipped-file / global notices
  let batchSession = $state<string | null>(null);
  let batchDone = $state(false); // a run has settled with something to resolve
  let fileInput: HTMLInputElement | undefined = $state();

  // Derived batch state — the rail and CTA read these, never raw status checks.
  const busy = $derived(pages.some((p) => p.status === 'queued' || p.status === 'processing'));
  const curatable = $derived(!busy); // can add/remove pages
  const processedCount = $derived(
    pages.filter((p) => p.status === 'success' || p.status === 'failed').length
  );
  const failedCount = $derived(pages.filter((p) => p.status === 'failed').length);
  const totalBookings = $derived(
    pages.reduce((n, p) => n + (p.status === 'success' ? p.count : 0), 0)
  );
  const pendingCount = $derived(pages.filter((p) => p.status === 'staged').length);

  // Pre-select the venue from ?venue (per-venue Import), else the first venue.
  $effect(() => {
    if (venueId || data.venues.length === 0) return;
    const pre = data.preselectVenueId;
    venueId = pre && data.venues.some((v) => v.id === pre) ? pre : data.venues[0].id;
  });

  // Consume a file handed over by the global drag-drop overlay (spec §8B).
  $effect(() => {
    const dropped = takePendingUpload();
    if (dropped) addFiles([dropped]);
  });

  // After an inline "add venue" succeeds, select it and collapse the form.
  $effect(() => {
    if (form?.newVenueId) {
      venueId = form.newVenueId;
      addOpen = false;
    }
  });

  function openPicker() {
    fileInput?.click();
  }

  // Stage files: reject non-images / oversized early (instant feedback instead
  // of a round-trip), keep the rest. Skipped files are summarised, not silent.
  function addFiles(incoming: File[]) {
    if (busy) return;
    batchDone = false;
    noticeMsg = '';
    let skipped = 0;
    const next: StagedPage[] = [];
    for (const file of incoming) {
      if (file.type && !file.type.startsWith('image/')) {
        skipped++;
        continue;
      }
      if (file.size > MAX_BYTES) {
        skipped++;
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'staged',
        count: 0,
        error: ''
      });
    }
    if (next.length) pages = [...pages, ...next];
    if (skipped) {
      noticeMsg = `${skipped} ${skipped === 1 ? 'file was' : 'files were'} skipped — add images up to 10 MB.`;
    }
  }

  function onFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (input.files?.length) addFiles(Array.from(input.files));
    input.value = ''; // allow re-picking the same file
  }

  function removePage(id: string) {
    if (busy) return;
    const p = pages.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.previewUrl);
    pages = pages.filter((x) => x.id !== id);
    if (pages.length === 0) batchDone = false;
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (!busy) dragging = true;
  }
  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    dragging = false;
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    if (e.dataTransfer?.files?.length) addFiles(Array.from(e.dataTransfer.files));
  }

  onDestroy(() => {
    for (const p of pages) URL.revokeObjectURL(p.previewUrl);
  });

  function setStatus(id: string, patch: Partial<StagedPage>) {
    const i = pages.findIndex((p) => p.id === id);
    if (i !== -1) pages[i] = { ...pages[i], ...patch };
  }

  // Read one page. Its own request, so a failure here never touches the others
  // (requirement 3 — item-level isolation). This ALWAYS settles: every path ends
  // in a success/failed setStatus, and a deadline guarantees a hung request
  // resolves to failed rather than awaiting forever (which would freeze its
  // worker and stall the whole batch).
  async function readOne(page: StagedPage, sessionId: string) {
    setStatus(page.id, { status: 'processing', error: '' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const fd = new FormData();
      fd.append('file', page.file);
      fd.append('venue_id', venueId);
      fd.append('session_id', sessionId);
      const res = await fetch('/api/extract', {
        method: 'POST',
        body: fd,
        signal: controller.signal
      });
      const body = (await res.json().catch(() => ({}))) as ExtractResponse;
      if (!res.ok) {
        throw new Error(body?.message || `Couldn't read this page (error ${res.status}).`);
      }
      setStatus(page.id, { status: 'success', count: body.count ?? 0 });
    } catch (e) {
      setStatus(page.id, {
        status: 'failed',
        error: controller.signal.aborted
          ? 'This page took too long to read. Tap retry to try again.'
          : e instanceof Error
            ? e.message
            : 'Something went wrong reading this page.'
      });
    } finally {
      clearTimeout(timer);
    }
  }

  // Concurrent pool: a fixed number of workers drain a shared queue. Each claims
  // the next id into a local FIRST, then looks it up — never `ids[cursor++]`
  // inside find(), which would over-advance the cursor and strand later pages.
  // allSettled means a stray rejection can't abandon the others mid-flight.
  async function runPool(ids: string[], sessionId: string) {
    let cursor = 0;
    const runners = Array.from({ length: Math.min(POOL, ids.length) }, async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        const page = pages.find((p) => p.id === id);
        if (page) await readOne(page, sessionId); // readOne always settles
      }
    });
    await Promise.allSettled(runners);
  }

  // Sequential: one page read to completion before the next. Slower for many
  // pages but trivially predictable. Selectable via the read-mode toggle.
  async function runSequential(ids: string[], sessionId: string) {
    for (const id of ids) {
      const page = pages.find((p) => p.id === id);
      if (page) await readOne(page, sessionId);
    }
  }

  async function readPages() {
    if (busy || !venueId) return;
    const queue = pages.filter((p) => p.status === 'staged' || p.status === 'failed');
    if (queue.length === 0) return;

    batchDone = false;
    noticeMsg = '';
    // One session for the whole batch (and reused on retry) so every booking
    // lands on the same confirm screen.
    if (!batchSession) batchSession = crypto.randomUUID();
    const queueIds = queue.map((p) => p.id);
    for (const id of queueIds) setStatus(id, { status: 'queued', error: '' });

    // BLOCK on the whole batch via the selected strategy. Either path resolves
    // only after every queued page has left 'queued'/'processing'; the redirect
    // is never evaluated before this returns.
    if (processMode === 'concurrent') {
      await runPool(queueIds, batchSession);
    } else {
      await runSequential(queueIds, batchSession);
    }

    // Settle gate (explicit + defensive): refuse to evaluate the redirect while
    // ANY page is still in flight. With the pool fully awaited this is already
    // true, but stating it makes the "whole array settled" contract edit-proof.
    const stillInFlight = pages.some((p) => p.status === 'queued' || p.status === 'processing');
    if (stillInFlight) return;

    // Read the settled set directly (not via derived) so the decision can't race
    // reactivity.
    const failed = pages.filter((p) => p.status === 'failed').length;
    const found = pages.reduce((n, p) => n + (p.status === 'success' ? p.count : 0), 0);

    // Clean sweep ONLY: zero failures across the whole gallery AND at least one
    // booking to review → auto-redirect. Any failure halts here and the mixed-
    // results state (brick-red failed tiles + Review/Retry path) takes over.
    if (failed === 0 && found > 0) {
      await goto(`/confirm?session=${batchSession}`);
      return;
    }
    batchDone = true;
  }
</script>

<svelte:head><title>Upload · Booking Capture</title></svelte:head>

<div class="upload-desk">
  <!-- Capture zone: the dominant mass. Empty → dropzone; staged → gallery.
       The whole column is the drop target either way. -->
  <input bind:this={fileInput} type="file" accept="image/*" multiple onchange={onFileChange} hidden />
  <div
    class="capture-area"
    class:dragging
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    ondrop={onDrop}
    role="group"
    aria-label="Staged diary pages"
  >
    {#if pages.length === 0}
      <button type="button" class="capture-zone" aria-label="Add diary photos" onclick={openPicker}>
        <span class="capture-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
          </svg>
        </span>
        <span class="capture-title text-h4">Add pages to the ledger</span>
        <span class="capture-hint">JPG, PNG or WEBP — up to 10&nbsp;MB each. Add as many as you like.</span>
        <span class="browse-cta">Browse files</span>
      </button>
    {:else}
      <ul class="gallery">
        {#each pages as page, i (page.id)}
          <li class="thumb" data-status={page.status} transition:fade={{ duration: 150 }}>
            <img class="thumb-img" src={page.previewUrl} alt={`Diary page ${i + 1}`} />

            {#if page.status !== 'staged'}
              <span class="thumb-veil" aria-hidden="true"></span>
            {/if}

            {#if page.status === 'processing'}
              <span class="thumb-scan" aria-hidden="true"></span>
            {/if}

            <!-- Status chip — one job per state (requirement 2). -->
            {#if page.status !== 'staged'}
              <span class="thumb-status" data-status={page.status}>
                {#if page.status === 'queued'}
                  Queued
                {:else if page.status === 'processing'}
                  Reading…
                {:else if page.status === 'success'}
                  <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 12.75 6 6 9-13.5" /></svg>
                  {page.count > 0 ? `${page.count} found` : 'No bookings'}
                {:else}
                  <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" /></svg>
                  Failed
                {/if}
              </span>
            {/if}

            {#if page.status === 'failed' && page.error}
              <span class="thumb-error" role="alert">{page.error}</span>
            {/if}

            {#if curatable}
              <button
                type="button"
                class="thumb-remove"
                aria-label={`Remove page ${i + 1}`}
                onclick={() => removePage(page.id)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            {/if}
          </li>
        {/each}

        {#if curatable}
          <li class="thumb add-tile">
            <button type="button" class="add-tile-btn" aria-label="Add more pages" onclick={openPicker}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4.5v15m7.5-7.5h-15" /></svg>
              <span>Add more</span>
            </button>
          </li>
        {/if}
      </ul>
    {/if}
  </div>

  <!-- Margin rail: venue, progress, and the single primary action. -->
  <aside class="margin-rail">
    <p class="overline">Step 1</p>

    <section class="venue-section">
      <label class="field-label" for="venue">Which venue's diary is this?</label>

      {#if data.venues.length}
        <div class="select-wrap">
          <select id="venue" class="input-field select-field" bind:value={venueId} disabled={busy}>
            {#each data.venues as v (v.id)}
              <option value={v.id}>{v.name}</option>
            {/each}
          </select>
          <svg class="select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      {:else}
        <p class="empty-venues">No venues yet — add one below to get started.</p>
      {/if}

      {#if addOpen}
        <form
          method="POST"
          action="?/addVenue"
          class="add-venue-form"
          use:enhance={() => {
            return async ({ update }) => {
              await update();
            };
          }}
        >
          <div class="add-row">
            <input class="input-field" name="name" placeholder="Venue name" autocomplete="off" required />
            <input class="input-field" name="phone" type="tel" inputmode="tel" placeholder="Phone (optional)" autocomplete="off" />
          </div>
          {#if form?.addError}
            <p class="add-error" role="alert">{form.addError}</p>
          {/if}
          <div class="add-actions">
            <button type="submit" class="btn-primary add-save">Save venue</button>
            <button type="button" class="add-cancel" onclick={() => (addOpen = false)}>Cancel</button>
          </div>
        </form>
      {:else}
        <button type="button" class="add-venue-toggle" onclick={() => (addOpen = true)} disabled={busy}>
          + Add a venue
        </button>
      {/if}
    </section>

    <!-- Read mode — concurrent (default, faster) vs sequential. Locked mid-run.
         Shown once there are pages staged so it doesn't clutter the empty state. -->
    {#if pages.length > 0}
      <section class="mode-section">
        <span class="field-label" id="mode-label">Read mode</span>
        <div class="mode-toggle" role="radiogroup" aria-labelledby="mode-label">
          <button
            type="button"
            role="radio"
            class="mode-opt"
            class:active={processMode === 'concurrent'}
            aria-checked={processMode === 'concurrent'}
            disabled={busy}
            onclick={() => (processMode = 'concurrent')}
          >
            Concurrent
          </button>
          <button
            type="button"
            role="radio"
            class="mode-opt"
            class:active={processMode === 'sequential'}
            aria-checked={processMode === 'sequential'}
            disabled={busy}
            onclick={() => (processMode = 'sequential')}
          >
            Sequential
          </button>
        </div>
        <p class="mode-hint">
          {processMode === 'concurrent'
            ? `Reads up to ${POOL} pages at once — faster for a stack.`
            : 'Reads one page at a time — slower, fully predictable.'}
        </p>
      </section>
    {/if}

    <!-- Batch progress — a quiet rule that fills, not a spinner (requirement 2). -->
    {#if busy || batchDone}
      <section class="batch" aria-label="Reading progress">
        <div class="batch-line">
          <span class="batch-count tabular">{processedCount}/{pages.length}</span>
          <span class="batch-label" aria-live="polite">
            {#if busy}
              Reading {pages.length} page{pages.length === 1 ? '' : 's'}…
            {:else if totalBookings > 0}
              {totalBookings} booking{totalBookings === 1 ? '' : 's'} found{failedCount > 0 ? ` · ${failedCount} page${failedCount === 1 ? '' : 's'} failed` : ''}
            {:else}
              No bookings read{failedCount > 0 ? ` · ${failedCount} page${failedCount === 1 ? '' : 's'} failed` : ''}
            {/if}
          </span>
        </div>
        <div class="batch-track" role="progressbar" aria-valuenow={processedCount} aria-valuemin="0" aria-valuemax={pages.length}>
          <span class="batch-fill" style={`width: ${pages.length ? (processedCount / pages.length) * 100 : 0}%`}></span>
        </div>
      </section>
    {/if}

    {#if noticeMsg}
      <p class="notice" role="status">{noticeMsg}</p>
    {/if}

    <!-- Primary action shifts with state, but there's only ever one CTA (§5). -->
    {#if batchDone && totalBookings > 0}
      <button class="btn-primary submit-cta" type="button" onclick={() => goto(`/confirm?session=${batchSession}`)}>
        Review {totalBookings} booking{totalBookings === 1 ? '' : 's'}
      </button>
      {#if failedCount > 0}
        <button class="retry-link" type="button" onclick={readPages}>
          Retry {failedCount} failed page{failedCount === 1 ? '' : 's'}
        </button>
      {/if}
    {:else}
      <button
        class="btn-primary submit-cta"
        type="button"
        onclick={readPages}
        disabled={busy || !venueId || (pendingCount === 0 && failedCount === 0)}
      >
        {#if busy}
          Reading…
        {:else if failedCount > 0 && pendingCount === 0}
          Retry {failedCount} page{failedCount === 1 ? '' : 's'}
        {:else}
          Read {pendingCount || pages.length} page{(pendingCount || pages.length) === 1 ? '' : 's'}
        {/if}
      </button>
    {/if}
  </aside>
</div>

<style>
  .upload-desk {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  /* ── Capture area — drop target wrapping either state ──────────────────── */
  .capture-area {
    border-radius: var(--radius-lg);
    transition: box-shadow var(--duration-base) var(--ease-premium);
  }
  .capture-area.dragging {
    box-shadow: 0 0 0 2px var(--color-accent);
  }

  .capture-zone {
    appearance: none;
    -webkit-appearance: none;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-1);
    width: 100%;
    min-height: clamp(20rem, 48vh, 34rem);
    padding: var(--spacing-4);
    text-align: center;
    font: inherit;
    color: inherit;
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border-base);
    border-radius: var(--radius-lg);
    cursor: pointer;
    overflow: hidden;
    box-shadow: inset 6px 0 12px -8px rgba(0, 0, 0, 0.25);
    transition:
      background-color var(--duration-base) var(--ease-premium),
      border-color var(--duration-base) var(--ease-premium);
  }
  .capture-zone:hover {
    background-color: var(--color-bg-sunken);
    border-color: var(--color-border-strong);
  }
  .capture-icon {
    color: var(--color-text-tertiary);
  }
  .capture-icon svg {
    width: 2.5rem;
    height: 2.5rem;
  }
  .capture-title {
    color: var(--color-text-primary);
  }
  .capture-hint {
    max-width: 22rem;
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--color-text-tertiary);
  }
  .browse-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: var(--spacing-1);
    min-height: 44px;
    padding-inline: var(--spacing-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-primary);
    background-color: transparent;
    transition:
      border-color var(--duration-base) var(--ease-premium),
      color var(--duration-base) var(--ease-premium);
  }
  .capture-zone:hover .browse-cta,
  .capture-zone:focus-visible .browse-cta {
    border-color: var(--color-accent);
    color: var(--color-accent-text);
  }

  /* ── Gallery of staged pages ───────────────────────────────────────────── */
  .gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 8.5rem), 1fr));
    gap: var(--spacing-2);
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .thumb {
    position: relative;
    aspect-ratio: 4 / 5;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--color-border-base);
    background-color: var(--color-bg-sunken);
  }
  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* Veil + scan during async work — a darkened wash, not a spinner. */
  .thumb-veil {
    position: absolute;
    inset: 0;
    background-color: color-mix(in srgb, var(--color-bg-base) 45%, transparent);
    transition: background-color var(--duration-base) var(--ease-premium);
  }
  .thumb[data-status='success'] .thumb-veil {
    background-color: color-mix(in srgb, var(--color-bg-base) 20%, transparent);
  }
  .thumb[data-status='failed'] .thumb-veil {
    background-color: color-mix(in srgb, var(--color-danger-bg) 55%, transparent);
  }
  .thumb-scan {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--color-accent);
    box-shadow: 0 0 12px 1px var(--color-accent);
    animation: scan-sweep 1.6s var(--ease-standard) infinite;
  }

  /* Status chip — bottom-left, temperature/semantic tokens (requirement 2). */
  .thumb-status {
    position: absolute;
    inset-block-end: var(--spacing-1);
    inset-inline-start: var(--spacing-1);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-0h);
    max-width: calc(100% - var(--spacing-2));
    padding: 0.1875rem var(--spacing-1);
    border-radius: var(--radius-sm);
    font-size: var(--text-2xs);
    font-weight: 600;
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    white-space: nowrap;
    background-color: var(--color-temp-cold-bg);
    color: var(--color-temp-cold-text);
  }
  .thumb-status[data-status='processing'] {
    background-color: var(--color-accent-subtle);
    color: var(--color-accent-text);
  }
  .thumb-status[data-status='success'] {
    background-color: var(--color-temp-won-bg);
    color: var(--color-temp-won-text);
  }
  .thumb-status[data-status='failed'] {
    background-color: var(--color-temp-lost-bg);
    color: var(--color-temp-lost-text);
  }
  .status-icon {
    width: 0.75rem;
    height: 0.75rem;
  }
  .thumb-error {
    position: absolute;
    inset-block-start: var(--spacing-1);
    inset-inline: var(--spacing-1);
    padding: var(--spacing-0h) var(--spacing-1);
    border-radius: var(--radius-sm);
    font-size: var(--text-2xs);
    line-height: var(--leading-snug);
    color: var(--color-text-inverse);
    background-color: color-mix(in srgb, var(--color-danger-text) 88%, transparent);
  }

  /* Remove — corner control, appears on hover/focus; always shown on touch. */
  .thumb-remove {
    position: absolute;
    inset-block-start: var(--spacing-1);
    inset-inline-end: var(--spacing-1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-full);
    color: var(--color-text-inverse);
    background-color: color-mix(in srgb, var(--color-bg-base) 55%, transparent);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    opacity: 0;
    cursor: pointer;
    transition:
      opacity var(--duration-base) var(--ease-premium),
      background-color var(--duration-base) var(--ease-premium);
  }
  .thumb-remove::after {
    content: '';
    position: absolute;
    inset: -8px;
  }
  .thumb-remove svg {
    width: 1rem;
    height: 1rem;
  }
  .thumb:hover .thumb-remove,
  .thumb:focus-within .thumb-remove {
    opacity: 1;
  }
  .thumb-remove:hover {
    background-color: color-mix(in srgb, var(--color-danger-text) 80%, transparent);
  }
  @media (hover: none) {
    .thumb-remove {
      opacity: 1;
    }
  }

  /* Add-more tile — dashed hairline, matches a staged tile's footprint. */
  .add-tile {
    border-style: dashed;
    border-color: var(--color-border-strong);
    background-color: transparent;
  }
  .add-tile-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-0h);
    width: 100%;
    height: 100%;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-secondary);
    background-color: transparent;
    cursor: pointer;
    transition: color var(--duration-base) var(--ease-premium);
  }
  .add-tile-btn:hover {
    color: var(--color-accent-text);
  }
  .add-tile-btn svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  /* ── Margin rail ────────────────────────────────────────────────────────── */
  .margin-rail {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    min-width: 0;
  }
  .venue-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
    min-width: 0;
  }
  .field-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
  }
  .select-wrap {
    position: relative;
    width: 100%;
    min-width: 0; /* let the field shrink inside the flex rail, never overflow */
  }
  .select-field {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding-inline-end: var(--spacing-6);
    text-overflow: ellipsis; /* long venue names truncate instead of widening */
    cursor: pointer;
  }
  .select-chevron {
    position: absolute;
    inset-inline-end: var(--spacing-2);
    inset-block-start: 50%;
    transform: translateY(-50%);
    width: 1.25rem;
    height: 1.25rem;
    color: var(--color-text-tertiary);
    pointer-events: none;
  }
  .empty-venues {
    font-size: var(--text-sm);
    color: var(--color-text-tertiary);
  }
  .add-venue-toggle {
    align-self: flex-start;
    min-height: 44px;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-accent-text);
    transition: color var(--duration-base) var(--ease-premium);
  }
  .add-venue-toggle:hover {
    color: var(--color-accent);
  }
  .add-venue-toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .add-venue-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    margin-top: var(--spacing-1);
    padding: var(--spacing-2);
    background-color: var(--color-bg-sunken);
    border: 1px solid var(--color-border-base);
    border-radius: var(--radius-md);
  }
  .add-row {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }
  .add-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
  }
  .add-save {
    min-height: 44px;
    padding-inline: var(--spacing-2);
    font-size: var(--text-sm);
  }
  .add-cancel {
    min-height: 44px;
    padding-inline: var(--spacing-2);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
    transition: color var(--duration-base) var(--ease-premium);
  }
  .add-cancel:hover {
    color: var(--color-text-primary);
  }
  .add-error {
    font-size: var(--text-sm);
    color: var(--color-danger-text);
  }

  /* ── Read-mode toggle — low-profile segmented control ──────────────────── */
  .mode-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }
  .mode-toggle {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(--color-border-base);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-elevated);
  }
  .mode-opt {
    min-height: 36px;
    padding-inline: var(--spacing-1);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
    background-color: transparent;
    cursor: pointer;
    transition:
      color var(--duration-base) var(--ease-premium),
      background-color var(--duration-base) var(--ease-premium);
  }
  .mode-opt:hover:not(:disabled):not(.active) {
    color: var(--color-text-primary);
  }
  .mode-opt.active {
    color: var(--color-accent-text);
    background-color: var(--color-accent-subtle);
  }
  .mode-opt:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .mode-hint {
    font-size: var(--text-xs);
    line-height: var(--leading-snug);
    color: var(--color-text-tertiary);
  }

  /* ── Batch progress ────────────────────────────────────────────────────── */
  .batch {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }
  .batch-line {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-1);
  }
  .batch-count {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-primary);
  }
  .batch-label {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
  .batch-track {
    height: 4px;
    border-radius: var(--radius-full);
    background-color: var(--color-bg-sunken);
    overflow: hidden;
  }
  .batch-fill {
    display: block;
    height: 100%;
    border-radius: var(--radius-full);
    background-color: var(--color-accent);
    transition: width var(--duration-medium) var(--ease-premium);
  }

  .notice {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .submit-cta {
    width: 100%;
    margin-top: var(--spacing-1);
  }
  .retry-link {
    align-self: center;
    min-height: 44px;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-accent-text);
    transition: color var(--duration-base) var(--ease-premium);
  }
  .retry-link:hover {
    color: var(--color-accent);
  }

  @media (prefers-reduced-motion: reduce) {
    .thumb-scan {
      animation: none;
      top: 50%;
    }
  }

  /* ── lg+: asymmetric page + margin split (design-system.md §4/§9) ───────── */
  @media (min-width: 1024px) {
    .upload-desk {
      flex-direction: row;
      align-items: stretch;
      gap: var(--spacing-3);
    }
    .capture-area {
      flex: 0 0 64%;
    }
    .capture-zone {
      min-height: clamp(24rem, 70vh, 40rem);
    }
    .gallery {
      grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    }
    .margin-rail {
      flex: 1;
      justify-content: center;
      padding: var(--spacing-3);
      background-color: var(--color-bg-sunken);
      border-radius: var(--radius-lg);
    }
  }
</style>
