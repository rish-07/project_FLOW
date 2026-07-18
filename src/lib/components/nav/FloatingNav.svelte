<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { Spring, prefersReducedMotion } from 'svelte/motion';

  // Heroicons v2 — outline (stroke) inactive, solid (fill) active. Same set as
  // the old TabBar so the switch to a floating pill changes only the chrome.
  const tabs = [
    {
      href: '/upload',
      label: 'Upload',
      outline:
        'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 7.5 12 3m0 0L7.5 7.5M12 3v13.5',
      solid:
        'M11.47 2.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06l-3.22-3.22V16.5a.75.75 0 0 1-1.5 0V4.81L8.03 8.03a.75.75 0 0 1-1.06-1.06l4.5-4.5ZM3 15.75a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z'
    },
    {
      href: '/leads',
      label: 'Leads',
      outline:
        'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z',
      solid:
        'M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z'
    },
    {
      href: '/calls',
      label: 'Calls',
      outline:
        'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z',
      solid:
        'M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z'
    }
  ];

  const pathname = $derived($page.url.pathname);
  // Longest-prefix match; -1 on non-tab routes (e.g. /confirm) → no active cell.
  const matchedIndex = $derived(
    tabs.findIndex((t) => pathname === t.href || pathname.startsWith(t.href + '/'))
  );
  const hasActive = $derived(matchedIndex !== -1);

  // ── Indicator capsule: two independent edge springs. The edge leading the
  // travel is snappier (overshoots); the trailing edge is more damped (lags).
  // The transient gap between them is the elastic stretch. Springs carry their
  // own velocity, so rapid taps interrupt the in-flight motion smoothly.
  const LEAD = { stiffness: 0.16, damping: 0.55 };
  const TRAIL = { stiffness: 0.1, damping: 0.78 };
  const INSET_X = 8; // horizontal inset of the capsule within a cell

  const leftEdge = new Spring(0, TRAIL);
  const rightEdge = new Spring(0, LEAD);

  let cellsEl: HTMLDivElement | undefined;
  const cellEls: HTMLAnchorElement[] = [];
  let metrics = $state<{ left: number; width: number }[]>([]);
  let measured = $state(false);
  let placed = false; // first placement snaps; later moves animate
  let lastIndex = -1;

  const restLeft = (i: number) => metrics[i].left + INSET_X;
  const restRight = (i: number) => metrics[i].left + metrics[i].width - INSET_X;
  const restWidth = (i: number) => Math.max(restRight(i) - restLeft(i), 1);

  function setEdgeParams(dir: 'right' | 'left') {
    const lead = dir === 'right' ? rightEdge : leftEdge;
    const trail = dir === 'right' ? leftEdge : rightEdge;
    lead.stiffness = LEAD.stiffness;
    lead.damping = LEAD.damping;
    trail.stiffness = TRAIL.stiffness;
    trail.damping = TRAIL.damping;
  }

  function moveTo(i: number, instant: boolean) {
    if (!metrics[i]) return;
    setEdgeParams(i >= lastIndex ? 'right' : 'left');
    leftEdge.set(restLeft(i), { instant });
    rightEdge.set(restRight(i), { instant });
    lastIndex = i;
  }

  function measure() {
    if (!cellsEl || cellEls.length !== tabs.length || cellEls.some((el) => !el)) return;
    metrics = cellEls.map((el) => ({ left: el.offsetLeft, width: el.offsetWidth }));
    measured = true;
    // Keep the capsule glued to the active cell across resize / font swap.
    if (placed && hasActive) {
      leftEdge.set(restLeft(matchedIndex), { instant: true });
      rightEdge.set(restRight(matchedIndex), { instant: true });
    }
  }

  // Drive the capsule when the active tab changes (or once metrics arrive).
  $effect(() => {
    if (!measured || !hasActive || matchedIndex === lastIndex) return;
    moveTo(matchedIndex, !placed || prefersReducedMotion.current);
    placed = true;
  });

  const capsuleWidth = $derived(
    hasActive && measured
      ? Math.min(
          Math.max(rightEdge.current - leftEdge.current, restWidth(matchedIndex) * 0.6),
          restWidth(matchedIndex) * 2.2
        )
      : 0
  );

  // ── Scroll-reactive shrink: recede on scroll-down, restore on scroll-up.
  let shrunk = $state(false);

  onMount(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (cellsEl) ro.observe(cellsEl);
    // Label widths shift once the web fonts load — re-measure then.
    document.fonts?.ready.then(measure);

    let lastY = window.scrollY;
    const onScroll = () => {
      if (prefersReducedMotion.current) return;
      const y = window.scrollY;
      const dy = y - lastY;
      if (dy > 6 && y > 40) shrunk = true;
      else if (dy < -6) shrunk = false;
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  });

  // Reset the shrink on navigation so a new screen always starts at full size.
  $effect(() => {
    pathname;
    shrunk = false;
  });
</script>

<nav class="floating-nav" aria-label="Primary">
  <div class="pill" class:shrunk>
    <div class="cells" bind:this={cellsEl}>
      {#if hasActive && measured}
        <span
          class="capsule"
          aria-hidden="true"
          style="left: {leftEdge.current}px; width: {capsuleWidth}px"
        ></span>
      {/if}
      {#each tabs as tab, i (tab.href)}
        {@const active = i === matchedIndex}
        <a
          bind:this={cellEls[i]}
          href={tab.href}
          class="cell"
          class:active
          aria-current={active ? 'page' : undefined}
        >
          <svg
            class="cell-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill={active ? 'currentColor' : 'none'}
            stroke={active ? 'none' : 'currentColor'}
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d={active ? tab.solid : tab.outline} />
          </svg>
          <span class="cell-label">{tab.label}</span>
        </a>
      {/each}
    </div>
  </div>
</nav>

<style>
  /* Centered floating utility — a bounded pill, never edge-to-edge. The wrapper
     is click-through; only the pill itself catches pointer events. */
  .floating-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(env(safe-area-inset-bottom, 0px) + var(--spacing-1));
    z-index: 50;
    display: flex;
    justify-content: center;
    padding-inline: var(--spacing-2);
    pointer-events: none;
  }

  .pill {
    pointer-events: auto;
    position: relative;
    display: flex;
    max-width: 380px;
    padding: 6px;
    border-radius: var(--radius-full);
    border: 1px solid var(--color-border-base);
    background-color: color-mix(in srgb, var(--color-bg-elevated) 80%, transparent);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    box-shadow: var(--shadow-md);
    transform-origin: bottom center;
    transition: transform var(--duration-short) var(--ease-spring);
  }
  /* Recede (keep the slot) while scrolling down a long screen. */
  .pill.shrunk {
    transform: scale(0.9);
    transition: transform var(--duration-base) var(--ease-exit);
  }

  .cells {
    position: relative;
    display: flex;
    gap: var(--spacing-0h);
  }

  /* One shared indicator behind the cells; JS drives left + width. */
  .capsule {
    position: absolute;
    z-index: 0;
    top: 4px;
    bottom: 4px;
    border-radius: var(--radius-full);
    background-color: var(--color-accent-subtle);
    pointer-events: none;
  }

  .cell {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 5.25rem;
    height: 52px;
    border-radius: var(--radius-full);
    color: var(--color-text-tertiary);
    transition: color var(--duration-base) var(--ease-premium);
  }
  .cell.active {
    color: var(--color-accent);
  }
  .cell-icon {
    width: 1.5rem;
    height: 1.5rem;
  }
  .cell-label {
    font-size: var(--text-xs);
    font-weight: 500;
  }

  /* No backdrop-filter support (or reduced transparency) → solid surface. */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .pill {
      background-color: var(--color-bg-elevated);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pill,
    .pill.shrunk {
      transition: none;
    }
  }
</style>
