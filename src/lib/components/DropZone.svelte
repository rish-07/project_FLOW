<script lang="ts">
  import { fade } from 'svelte/transition';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { setPendingUpload } from '$lib/stores/pendingUpload.svelte';

  // Global drag-drop seam (spec §8B): a full-page overlay appears when an image
  // is dragged anywhere over the app, and routes the dropped file into the
  // existing upload → extract → confirm flow. It never injects rows directly —
  // confirm is always the gate. Disabled on /upload, which has its own zone.

  const enabled = $derived(!$page.url.pathname.startsWith('/upload'));

  let active = $state(false);
  // dragenter/leave fire per descendant element; count depth to avoid flicker.
  let depth = 0;

  function hasFiles(e: DragEvent): boolean {
    return Array.from(e.dataTransfer?.types ?? []).includes('Files');
  }

  function onEnter(e: DragEvent) {
    if (!enabled || !hasFiles(e)) return;
    depth += 1;
    active = true;
  }
  function onOver(e: DragEvent) {
    if (!enabled || !hasFiles(e)) return;
    e.preventDefault(); // required so a drop event will fire
  }
  function onLeave() {
    if (!active) return;
    depth -= 1;
    if (depth <= 0) {
      depth = 0;
      active = false;
    }
  }
  async function onDrop(e: DragEvent) {
    if (!enabled) return;
    e.preventDefault();
    depth = 0;
    active = false;
    const file = Array.from(e.dataTransfer?.files ?? []).find((f) =>
      f.type.startsWith('image/')
    );
    if (!file) return;
    setPendingUpload(file);
    await goto('/upload');
  }

  function reduced(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
  const fadeParams = () => ({ duration: reduced() ? 0 : 150 });
</script>

<svelte:window
  ondragenter={onEnter}
  ondragover={onOver}
  ondragleave={onLeave}
  ondrop={onDrop}
/>

{#if active && enabled}
  <div class="drop-overlay glass" transition:fade={fadeParams()} aria-hidden="true">
    <div class="drop-card">
      <span class="drop-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      </span>
      <p class="drop-title">Drop the diary photo to read it</p>
      <p class="drop-sub">We'll extract the bookings — you confirm before anything is saved.</p>
    </div>
  </div>
{/if}

<style>
  .drop-overlay {
    position: fixed;
    inset: 0;
    z-index: 75;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-3);
    background-color: var(--color-bg-overlay);
    pointer-events: none; /* let the drop reach the window handler */
  }
  /* Theme-correct elevated card — the scrim is dark in both themes, so text
     must come from a surface, not from text-inverse (which flips). */
  .drop-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-1);
    width: 100%;
    max-width: 30rem;
    padding: var(--spacing-6);
    text-align: center;
    background-color: var(--color-bg-elevated);
    border: 2px dashed var(--color-accent);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
  }
  .drop-icon {
    color: var(--color-accent);
  }
  .drop-icon svg {
    width: 3rem;
    height: 3rem;
  }
  .drop-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }
  .drop-sub {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
</style>
