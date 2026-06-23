<script lang="ts">
  import { tick } from 'svelte';
  import { portal } from '$lib/actions/portal';
  import { STATUS_LABELS } from '$lib/utils';
  import type { Status } from '$lib/stores/leads.svelte';

  let {
    leadId,
    status,
    name,
    onStatusChange
  }: {
    leadId: string;
    status: Status;
    name: string;
    onStatusChange: (leadId: string, status: Status) => void;
  } = $props();

  const STATUSES: Status[] = [
    'new',
    'no_answer',
    'interested',
    'quoted',
    'booked',
    'not_interested',
    'callback'
  ];

  // Temperature mapping (design-system.md §3) — status is read as how close a
  // lead is to closing, not an arbitrary category. cold -> warming -> warm -> won/lost.
  const TEMP_TOKEN: Record<Status, string> = {
    new: 'cold',
    no_answer: 'warming',
    callback: 'warming',
    interested: 'warm',
    quoted: 'warm',
    booked: 'won',
    not_interested: 'lost'
  };
  function tokenVars(s: Status): string {
    const t = TEMP_TOKEN[s];
    return `--pill-bg: var(--color-temp-${t}-bg); --pill-text: var(--color-temp-${t}-text);`;
  }

  let open = $state(false);
  let activeIndex = $state(0);
  let menuStyle = $state('');
  let triggerEl = $state<HTMLButtonElement>();
  let menuEl = $state<HTMLDivElement>();

  // Brief scale pulse on status change (design-system.md §5) — the one
  // moment a pill is allowed to move; at rest it never animates.
  let pulsing = $state(false);
  let pulseTimer: ReturnType<typeof setTimeout> | undefined;
  let prevStatus = status;
  $effect(() => {
    if (status !== prevStatus) {
      prevStatus = status;
      pulsing = true;
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => (pulsing = false), 250);
    }
  });

  const MENU_WIDTH = 208;
  const OPTION_H = 40;

  function positionMenu() {
    if (!triggerEl) return;
    const r = triggerEl.getBoundingClientRect();
    const gap = 4;
    let left = Math.min(r.left, window.innerWidth - MENU_WIDTH - 8);
    if (left < 8) left = 8;
    const menuH = STATUSES.length * OPTION_H + 8;
    let top = r.bottom + gap;
    if (top + menuH > window.innerHeight - 8) {
      top = Math.max(8, r.top - gap - menuH); // flip up when no room below
    }
    menuStyle = `top:${top}px; left:${left}px; width:${MENU_WIDTH}px;`;
  }

  function focusOption(i: number) {
    // preventScroll: moving focus into the portaled menu must NOT scroll the
    // viewport — on mobile that caused an aggressive jump when opening the pill.
    menuEl?.querySelectorAll<HTMLButtonElement>('[role="option"]')[i]?.focus({ preventScroll: true });
  }

  async function openMenu() {
    open = true;
    activeIndex = Math.max(0, STATUSES.indexOf(status));
    await tick();
    positionMenu();
    focusOption(activeIndex);
  }
  function closeMenu(refocus = true) {
    open = false;
    if (refocus) triggerEl?.focus({ preventScroll: true });
  }
  function select(s: Status) {
    onStatusChange(leadId, s);
    closeMenu();
  }

  function onTriggerKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    }
  }
  function onMenuKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        closeMenu();
        break;
      case 'ArrowDown':
        e.preventDefault();
        activeIndex = (activeIndex + 1) % STATUSES.length;
        focusOption(activeIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        activeIndex = (activeIndex - 1 + STATUSES.length) % STATUSES.length;
        focusOption(activeIndex);
        break;
      case 'Home':
        e.preventDefault();
        activeIndex = 0;
        focusOption(0);
        break;
      case 'End':
        e.preventDefault();
        activeIndex = STATUSES.length - 1;
        focusOption(activeIndex);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        select(STATUSES[activeIndex]);
        break;
      case 'Tab':
        closeMenu(false); // let focus move on naturally
        break;
    }
  }

  function onWindowPointer(e: PointerEvent) {
    if (!open) return;
    const t = e.target as Node;
    if (triggerEl?.contains(t) || menuEl?.contains(t)) return;
    closeMenu(false);
  }

  // Close on any scroll (capture catches the table's own overflow scroll too).
  $effect(() => {
    if (!open) return;
    const onScroll = () => closeMenu(false);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  });
</script>

<svelte:window onpointerdown={onWindowPointer} onresize={() => open && closeMenu(false)} />

<button
  bind:this={triggerEl}
  class="pill-trigger"
  class:pulsing
  style={tokenVars(status)}
  type="button"
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-label={`Status for ${name}: ${STATUS_LABELS[status]}. Change status`}
  onclick={() => (open ? closeMenu(false) : openMenu())}
  onkeydown={onTriggerKeydown}
>
  <span class="dot" aria-hidden="true"></span>
  <span class="pill-label">{STATUS_LABELS[status]}</span>
  <svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
</button>

{#if open}
  <div
    bind:this={menuEl}
    use:portal
    class="menu"
    role="listbox"
    tabindex="-1"
    aria-label={`Set status for ${name}`}
    style={menuStyle}
    onkeydown={onMenuKeydown}
  >
    {#each STATUSES as s, i (s)}
      <button
        class="option"
        type="button"
        role="option"
        aria-selected={s === status}
        tabindex="-1"
        style={tokenVars(s)}
        onclick={() => select(s)}
        onmouseenter={() => (activeIndex = i)}
      >
        <span class="dot" aria-hidden="true"></span>
        <span class="option-label">{STATUS_LABELS[s]}</span>
        {#if s === status}
          <svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        {/if}
      </button>
    {/each}
  </div>
{/if}

<span class="sr-only" aria-live="polite">{STATUS_LABELS[status]}</span>

<style>
  /* Trigger — temperature pill (§5): sized to its content so the label is always
     fully readable; the host cell (.col-status) guarantees the column width. */
  .pill-trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-1);
    width: auto;
    max-width: 100%;
    height: 1.5rem;
    padding-inline: 0.625rem;
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: 500;
    background-color: var(--pill-bg);
    color: var(--pill-text);
    cursor: pointer;
    transition:
      background-color var(--duration-base) var(--ease-standard),
      color var(--duration-base) var(--ease-standard);
  }
  /* Structural change (status update), not a hover — ease-standard + the one
     permitted moment of pill motion (design-system.md §5). */
  .pill-trigger.pulsing {
    animation: pill-pulse var(--duration-medium) var(--ease-spring);
  }
  .pill-label {
    white-space: nowrap; /* never wrap or truncate the status word */
    text-align: left;
  }
  .caret {
    width: 0.75rem;
    height: 0.75rem;
    flex-shrink: 0;
    opacity: 0.7;
  }
  .dot {
    width: 0.5rem;
    height: 0.5rem;
    flex-shrink: 0;
    border-radius: var(--radius-full);
    background-color: currentColor;
  }

  /* Menu — elevation 4 (§7), low-opacity border (§1B), portaled + fixed. */
  .menu {
    position: fixed;
    z-index: 60;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-0h);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
  }
  .option {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
    height: 2.5rem;
    padding-inline: var(--spacing-2);
    border-radius: var(--radius-sm);
    text-align: left;
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    background-color: transparent;
    cursor: pointer;
    transition: background-color var(--duration-base) var(--ease-premium);
  }
  /* dot inside an option carries that status's temperature colour */
  .option .dot {
    color: var(--pill-text);
  }
  .option:hover,
  .option:focus-visible {
    background-color: var(--color-bg-sunken);
  }
  .option[aria-selected='true'] {
    color: var(--color-accent-text);
    font-weight: 600;
  }
  .option-label {
    flex: 1;
  }
  .check {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
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

  @media (prefers-reduced-motion: reduce) {
    .pill-trigger.pulsing {
      animation: none;
    }
  }
</style>
