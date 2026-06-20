<script lang="ts">
  import { onDestroy } from 'svelte';
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { takePendingUpload } from '$lib/stores/pendingUpload.svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  type ExtractResponse = { session_id?: string; count?: number; message?: string };

  let file = $state<File | null>(null);
  let previewUrl = $state('');
  let venueId = $state('');
  let addOpen = $state(false);
  let loading = $state(false);
  let errorMsg = $state('');
  let dragging = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();

  // Pre-select the venue from ?venue (per-venue Import), else the first venue.
  $effect(() => {
    if (venueId || data.venues.length === 0) return;
    const pre = data.preselectVenueId;
    venueId = pre && data.venues.some((v) => v.id === pre) ? pre : data.venues[0].id;
  });

  // Consume a file handed over by the global drag-drop overlay (spec §8B).
  $effect(() => {
    const dropped = takePendingUpload();
    if (dropped) setFile(dropped);
  });

  function openPicker() {
    fileInput?.click();
  }

  // Single entry point for both browse and drop. Reject non-images early so she
  // gets instant feedback instead of a 415 after the round-trip.
  function setFile(next: File | null) {
    if (next && !next.type.startsWith('image/')) {
      errorMsg = 'That file isn’t an image. Please choose a JPG, PNG or WEBP.';
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    file = next;
    previewUrl = next ? URL.createObjectURL(next) : '';
    errorMsg = '';
  }

  function onFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    setFile(input.files?.[0] ?? null);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragging = true;
  }
  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    dragging = false;
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    setFile(e.dataTransfer?.files?.[0] ?? null);
  }

  onDestroy(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });

  // After an inline "add venue" succeeds, the action returns the new id —
  // select it and collapse the form. data.venues has already refreshed.
  $effect(() => {
    if (form?.newVenueId) {
      venueId = form.newVenueId;
      addOpen = false;
    }
  });

  async function submit() {
    if (!file || !venueId || loading) return;
    loading = true;
    errorMsg = '';

    const fd = new FormData();
    fd.append('file', file);
    fd.append('venue_id', venueId);

    try {
      const res = await fetch('/api/extract', { method: 'POST', body: fd });
      const body = (await res.json().catch(() => ({}))) as ExtractResponse;

      if (!res.ok) {
        throw new Error(body?.message || `Couldn't read the page (error ${res.status}).`);
      }
      if (!body.count) {
        loading = false;
        errorMsg = 'No bookings could be read from this page. Try a clearer, well-lit photo.';
        return;
      }
      await goto(`/confirm?session=${body.session_id}`);
    } catch (e) {
      loading = false;
      errorMsg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
    }
  }
</script>

<svelte:head><title>Upload · Booking Capture</title></svelte:head>

<div class="upload-screen">
  <p class="overline">Step 1</p>

  <!-- Primary affordance: tap / click / drag-drop to add a diary photo. -->
  <input
    bind:this={fileInput}
    type="file"
    accept="image/*"
    onchange={onFileChange}
    hidden
  />
  <button
    type="button"
    class="dropzone"
    class:has-photo={!!previewUrl}
    class:dragging
    aria-label="Add a diary photo"
    onclick={openPicker}
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    ondrop={onDrop}
  >
    {#if previewUrl}
      <img class="preview" src={previewUrl} alt="Selected diary page" />
      <span class="change-hint">Tap or drop to change photo</span>
    {:else}
      <span class="dropzone-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
          />
          <path d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
        </svg>
      </span>
      <span class="dropzone-title">Drag &amp; drop a diary photo</span>
      <span class="dropzone-hint">JPG, PNG or WEBP — up to 10&nbsp;MB</span>
      <span class="browse-cta">Browse files</span>
    {/if}
  </button>

  <!-- Venue picker sits below the zone so it never crowds the main action. -->
  <section class="venue-section">
    <label class="field-label" for="venue">Which venue's diary is this?</label>

    {#if data.venues.length}
      <div class="select-wrap">
        <select id="venue" class="input-field select-field" bind:value={venueId}>
          {#each data.venues as v (v.id)}
            <option value={v.id}>{v.name}</option>
          {/each}
        </select>
        <svg
          class="select-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
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
          <input
            class="input-field"
            name="phone"
            type="tel"
            inputmode="tel"
            placeholder="Phone (optional)"
            autocomplete="off"
          />
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
      <button type="button" class="add-venue-toggle" onclick={() => (addOpen = true)}>
        + Add a venue
      </button>
    {/if}
  </section>

  {#if errorMsg}
    <div class="error-card" role="alert">
      <p class="error-text">{errorMsg}</p>
      <button type="button" class="retry-btn" onclick={() => (errorMsg = '')}>Try again</button>
    </div>
  {/if}

  <button
    class="btn-primary submit-cta"
    type="button"
    onclick={submit}
    disabled={!file || !venueId || loading}
  >
    {loading ? 'Reading…' : 'Read the diary page'}
  </button>
</div>

{#if loading}
  <div class="loading-overlay glass" role="status" aria-live="polite">
    <div class="loading-card">
      <div class="pulse-dots" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="loading-text">Reading the diary page…</p>
      <p class="loading-sub">Extracting bookings — this takes a few seconds.</p>
    </div>
  </div>
{/if}

<style>
  .upload-screen {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  /* ── Capture zone ──────────────────────────────────────────────── */
  .dropzone {
    appearance: none;
    -webkit-appearance: none;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-1);
    width: 100%;
    min-height: clamp(18rem, 42vh, 30rem);
    padding: var(--spacing-4);
    text-align: center;
    font: inherit;
    color: inherit;
    background-color: var(--color-bg-elevated);
    border: 2px dashed var(--color-border-strong);
    border-radius: var(--radius-lg);
    cursor: pointer;
    overflow: hidden;
    transition:
      border-color var(--duration-short) var(--ease-standard),
      background-color var(--duration-short) var(--ease-standard);
  }
  .dropzone:hover {
    border-color: var(--color-accent);
    background-color: var(--color-bg-sunken);
  }
  /* Active drag-over state — clearly invite the drop. */
  .dropzone.dragging {
    border-color: var(--color-accent);
    background-color: var(--color-accent-subtle);
  }
  .dropzone.has-photo {
    border-style: solid;
    border-color: var(--color-border-base);
    padding: 0;
  }

  .dropzone-icon {
    color: var(--color-text-tertiary);
  }
  .dropzone-icon svg {
    width: 2.5rem;
    height: 2.5rem;
  }
  .dropzone-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }
  .dropzone-hint {
    font-size: var(--text-sm);
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
    background-color: var(--color-bg-base);
    transition:
      border-color var(--duration-short) var(--ease-standard),
      color var(--duration-short) var(--ease-standard);
  }
  .dropzone:hover .browse-cta,
  .dropzone:focus-visible .browse-cta {
    border-color: var(--color-accent);
    color: var(--color-accent-text);
  }

  .preview {
    width: 100%;
    height: 100%;
    min-height: clamp(18rem, 42vh, 30rem);
    object-fit: cover;
    display: block;
  }
  .change-hint {
    position: absolute;
    inset-block-end: var(--spacing-2);
    inset-inline-end: var(--spacing-2);
    padding: var(--spacing-0h) var(--spacing-2);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text-inverse);
    background-color: color-mix(in srgb, var(--color-bg-base) 70%, transparent);
    border-radius: var(--radius-full);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  /* ── Venue picker ──────────────────────────────────────────────── */
  .venue-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }
  .field-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .select-wrap {
    position: relative;
  }
  .select-field {
    appearance: none;
    -webkit-appearance: none;
    padding-inline-end: var(--spacing-6);
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
    transition: color var(--duration-short) var(--ease-standard);
  }
  .add-venue-toggle:hover {
    color: var(--color-accent);
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
  }
  .add-cancel:hover {
    color: var(--color-text-primary);
  }
  .add-error {
    font-size: var(--text-sm);
    color: var(--color-danger-text);
  }

  /* ── Error + submit ────────────────────────────────────────────── */
  .error-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-2);
    padding: var(--spacing-2);
    font-size: var(--text-sm);
    color: var(--color-danger-text);
    background-color: var(--color-danger-bg);
    border-radius: var(--radius-md);
  }
  .retry-btn {
    flex-shrink: 0;
    min-height: 44px;
    padding-inline: var(--spacing-2);
    font-weight: 600;
    color: var(--color-danger-text);
  }

  .submit-cta {
    width: 100%;
    margin-top: var(--spacing-1);
  }

  /* ── Loading overlay ───────────────────────────────────────────── */
  .loading-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-3);
  }
  .loading-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-4);
    text-align: center;
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border-base);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }
  .loading-text {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }
  .loading-sub {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
  .pulse-dots {
    display: flex;
    gap: var(--spacing-1);
  }
  .pulse-dots span {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: var(--radius-full);
    background-color: var(--color-accent);
    animation: pulse-dot 1.2s var(--ease-standard) infinite;
  }
  .pulse-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .pulse-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes pulse-dot {
    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
    40% { opacity: 1; transform: scale(1); }
  }
</style>
