<script lang="ts">
  import { fade } from 'svelte/transition';
  import { prefersReducedMotion } from 'svelte/motion';

  let { src, alt }: { src: string; alt: string } = $props();

  let open = $state(false);
  let zoomed = $state(false); // fit-to-screen ⇄ actual size (pannable)
  let prevFocus: HTMLElement | null = null;

  function openLightbox() {
    prevFocus = (document.activeElement as HTMLElement) ?? null;
    zoomed = false;
    open = true;
  }
  function close() {
    open = false;
    prevFocus?.focus?.();
  }
  // Focus the dialog on open so Esc + screen readers land here; restore on close.
  function focusOnMount(node: HTMLElement) {
    node.focus();
  }
  function overlayFade() {
    return { duration: prefersReducedMotion.current ? 0 : 150 };
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (open && e.key === 'Escape') close();
  }}
/>

<button type="button" class="thumb" onclick={openLightbox} aria-label={`Zoom ${alt}`}>
  <img {src} {alt} loading="lazy" />
  <span class="hint" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="m21 21-4.34-4.34M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM10 7v6M7 10h6" />
    </svg>
  </span>
</button>

{#if open}
  <!-- Fullscreen viewer. The overlay is the scroll container that pans the image
       once it's zoomed to actual size; a full-bleed backdrop button closes it,
       and a button wrapping the image toggles fit ⇄ actual size. -->
  <div
    class="overlay"
    class:zoomed
    role="dialog"
    aria-modal="true"
    aria-label={alt}
    tabindex="-1"
    use:focusOnMount
    transition:fade={overlayFade()}
  >
    <button type="button" class="backdrop" aria-label="Close image" onclick={close}></button>
    <button
      type="button"
      class="zoom-toggle"
      class:zoomed
      aria-label={zoomed ? 'Fit image to screen' : 'Zoom in on image'}
      onclick={() => (zoomed = !zoomed)}
    >
      <img class="full" class:zoomed {src} {alt} />
    </button>
    <p class="tip" aria-hidden="true">
      {zoomed ? 'Tap image to fit' : 'Tap image to zoom · pinch for more'}
    </p>
    <button type="button" class="close" onclick={close} aria-label="Close image">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
{/if}

<style>
  /* ── Inline thumbnail ─────────────────────────────────────────────────── */
  .thumb {
    position: relative;
    display: block;
    width: 100%;
    max-height: clamp(8rem, 24vh, 14rem);
    overflow: hidden;
    border: 1px solid var(--color-border-base);
    border-radius: var(--radius-md);
    background-color: var(--color-bg-sunken);
    cursor: zoom-in;
  }
  .thumb img {
    display: block;
    width: 100%;
    max-height: clamp(8rem, 24vh, 14rem);
    object-fit: contain;
  }
  .hint {
    position: absolute;
    right: var(--spacing-1);
    bottom: var(--spacing-1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-full);
    color: var(--color-text-inverse);
    background-color: color-mix(in srgb, var(--color-text-primary) 62%, transparent);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }
  .hint svg {
    width: 1rem;
    height: 1rem;
  }

  /* ── Fullscreen lightbox ──────────────────────────────────────────────── */
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2);
    background-color: var(--color-bg-overlay);
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }
  /* When zoomed to actual size the image overflows — anchor to the top-left so
     every corner is reachable by panning (centred flex can't scroll to origin). */
  .overlay.zoomed {
    align-items: flex-start;
    justify-content: flex-start;
  }
  /* Full-bleed close target behind the image; margins around the image close. */
  .backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    border: 0;
    cursor: zoom-out;
  }
  /* Button wrapping the image — toggles fit ⇄ actual size; sits above backdrop. */
  .zoom-toggle {
    position: relative;
    z-index: 1;
    flex: 0 0 auto;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: zoom-in;
  }
  .zoom-toggle.zoomed {
    cursor: zoom-out;
  }
  .full {
    display: block;
    max-width: 100%;
    max-height: calc(100dvh - var(--spacing-4));
    object-fit: contain;
    border-radius: var(--radius-md);
  }
  .full.zoomed {
    max-width: none;
    max-height: none;
  }
  .tip {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(env(safe-area-inset-bottom, 0px) + var(--spacing-2));
    padding: var(--spacing-0h) var(--spacing-2);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    color: var(--color-text-inverse);
    background-color: color-mix(in srgb, var(--color-text-primary) 62%, transparent);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    pointer-events: none;
  }
  .close {
    position: fixed;
    top: calc(env(safe-area-inset-top, 0px) + var(--spacing-2));
    right: var(--spacing-2);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-full);
    color: var(--color-text-inverse);
    background-color: color-mix(in srgb, var(--color-text-primary) 62%, transparent);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }
  .close svg {
    width: 1.25rem;
    height: 1.25rem;
  }
</style>
