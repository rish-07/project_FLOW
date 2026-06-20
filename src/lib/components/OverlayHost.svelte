<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { leadsUi, closeOverlay } from '$lib/stores/leads.svelte';

  // Single store-driven overlay host (spec §8A). Mounted once at the app root,
  // never inside a row (the accordion clips overflow). Idle until a planned
  // transactional flow calls openOverlay(); the body is a stub for now.

  let dialogEl = $state<HTMLDivElement>();
  let prevFocus: HTMLElement | null = null;

  const active = $derived(leadsUi.activeOverlay);

  // Focus management: trap focus inside the dialog while open, restore on close.
  $effect(() => {
    if (active) {
      prevFocus = document.activeElement as HTMLElement | null;
      // focus after the node mounts
      queueMicrotask(() => dialogEl?.focus());
    } else if (prevFocus) {
      prevFocus.focus();
      prevFocus = null;
    }
  });

  function focusable(): HTMLElement[] {
    if (!dialogEl) return [];
    return Array.from(
      dialogEl.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]'
      )
      // exclude programmatically-focusable-only nodes (e.g. the scrim dismiss)
    ).filter((el) => el.tabIndex !== -1);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeOverlay();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = focusable();
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement;
    if (e.shiftKey && current === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && current === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Svelte JS transitions aren't covered by the global CSS reduced-motion rule.
  function reduced(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
  const fadeParams = () => ({ duration: reduced() ? 0 : 150 });
  const dialogParams = () => ({ duration: reduced() ? 0 : 200, start: reduced() ? 1 : 0.96 });
</script>

{#if active}
  <div class="scrim glass" transition:fade={fadeParams()}>
    <!-- clicking the scrim dismisses; the dialog stops propagation -->
    <button
      class="scrim-dismiss"
      type="button"
      aria-label="Close"
      tabindex="-1"
      onclick={closeOverlay}
    ></button>

    <div
      bind:this={dialogEl}
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="overlay-title"
      tabindex="-1"
      transition:scale={dialogParams()}
      onkeydown={onKeydown}
    >
      <p class="overline">Planned</p>
      <h2 id="overlay-title" class="dialog-title">Transactional flow</h2>
      <p class="dialog-body">
        This overlay is the seam for upcoming status-triggered flows (e.g. recording a
        payment when a lead is booked). It isn't wired to any transition yet.
      </p>
      <p class="dialog-meta">
        {active.type} · lead {active.leadId}
      </p>
      <button class="btn-primary close-btn" type="button" onclick={closeOverlay}>Close</button>
    </div>
  </div>
{/if}

<style>
  /* Elevation 4 overlay (design-system §7): frosted scrim + shadow-lg dialog. */
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-3);
    background-color: var(--color-bg-overlay);
  }
  .scrim-dismiss {
    position: absolute;
    inset: 0;
    background: transparent;
    border: 0;
    cursor: default;
  }

  .dialog {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 28rem;
    padding: var(--spacing-3);
    background-color: var(--color-bg-elevated);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
  }
  .dialog-title {
    margin-top: var(--spacing-0h);
    font-size: var(--text-xl);
    font-weight: 600;
    letter-spacing: var(--tracking-tight);
    color: var(--color-text-primary);
  }
  .dialog-body {
    margin-top: var(--spacing-1);
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--color-text-secondary);
  }
  .dialog-meta {
    margin-top: var(--spacing-2);
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    color: var(--color-text-tertiary);
  }
  .close-btn {
    width: 100%;
    margin-top: var(--spacing-3);
  }
</style>
