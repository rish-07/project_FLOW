<script lang="ts">
  import { tick } from 'svelte';
  import { portal } from '$lib/actions/portal';
  import { PLAN_LABELS, type ShowcasePlan } from '$lib/stores/leads.svelte';

  let {
    leadId,
    name,
    onSendShowcase
  }: {
    leadId: string;
    name: string;
    onSendShowcase: (leadId: string, plan: ShowcasePlan) => void;
  } = $props();

  // Grouped 2×2 (spec §6): Track / Live × Show / with Entry.
  const GROUPS: { label: string; items: { plan: ShowcasePlan; label: string }[] }[] = [
    { label: 'Track', items: [{ plan: 'track_show', label: 'Show' }, { plan: 'track_entry', label: 'with Entry' }] },
    { label: 'Live', items: [{ plan: 'live_show', label: 'Show' }, { plan: 'live_entry', label: 'with Entry' }] }
  ];
  // DOM/keyboard order across the 4 menuitems.
  const ORDER: ShowcasePlan[] = ['track_show', 'track_entry', 'live_show', 'live_entry'];

  let open = $state(false);
  let activeIndex = $state(0);
  let menuStyle = $state('');
  let triggerEl = $state<HTMLButtonElement>();
  let menuEl = $state<HTMLDivElement>();

  const MENU_WIDTH = 224;

  function positionMenu() {
    if (!triggerEl) return;
    const r = triggerEl.getBoundingClientRect();
    const gap = 4;
    // Right-align to the trigger (it sits at the table's right edge).
    let left = r.right - MENU_WIDTH;
    if (left + MENU_WIDTH > window.innerWidth - 8) left = window.innerWidth - MENU_WIDTH - 8;
    if (left < 8) left = 8;
    const menuH = 180;
    let top = r.bottom + gap;
    if (top + menuH > window.innerHeight - 8) top = Math.max(8, r.top - gap - menuH);
    menuStyle = `top:${top}px; left:${left}px; width:${MENU_WIDTH}px;`;
  }

  function focusItem(i: number) {
    menuEl?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[i]?.focus();
  }

  async function openMenu() {
    open = true;
    activeIndex = 0;
    await tick();
    positionMenu();
    focusItem(0);
  }
  function closeMenu(refocus = true) {
    open = false;
    if (refocus) triggerEl?.focus();
  }
  function select(plan: ShowcasePlan) {
    onSendShowcase(leadId, plan);
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
        activeIndex = (activeIndex + 1) % ORDER.length;
        focusItem(activeIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        activeIndex = (activeIndex - 1 + ORDER.length) % ORDER.length;
        focusItem(activeIndex);
        break;
      case 'Home':
        e.preventDefault();
        activeIndex = 0;
        focusItem(0);
        break;
      case 'End':
        e.preventDefault();
        activeIndex = ORDER.length - 1;
        focusItem(activeIndex);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        select(ORDER[activeIndex]);
        break;
      case 'Tab':
        closeMenu(false);
        break;
    }
  }

  function onWindowPointer(e: PointerEvent) {
    if (!open) return;
    const t = e.target as Node;
    if (triggerEl?.contains(t) || menuEl?.contains(t)) return;
    closeMenu(false);
  }

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
  class="send-btn"
  type="button"
  aria-haspopup="menu"
  aria-expanded={open}
  aria-label={`Send showcase to ${name}`}
  onclick={() => (open ? closeMenu(false) : openMenu())}
  onkeydown={onTriggerKeydown}
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
  </svg>
</button>

{#if open}
  <div
    bind:this={menuEl}
    use:portal
    class="menu"
    role="menu"
    tabindex="-1"
    aria-label={`Send a showcase to ${name}`}
    style={menuStyle}
    onkeydown={onMenuKeydown}
  >
    {#each GROUPS as g (g.label)}
      <p class="group-label">{g.label}</p>
      <div class="group-row">
        {#each g.items as it (it.plan)}
          <button
            class="menuitem"
            type="button"
            role="menuitem"
            tabindex="-1"
            aria-label={PLAN_LABELS[it.plan]}
            onclick={() => select(it.plan)}
            onmouseenter={() => (activeIndex = ORDER.indexOf(it.plan))}
          >
            {it.label}
          </button>
        {/each}
      </div>
    {/each}
  </div>
{/if}

<style>
  /* Trigger — ghost icon button (§6): 40×40 visible, hover accent + sunken. */
  .send-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    background-color: transparent;
    cursor: pointer;
    transition:
      color var(--duration-short) var(--ease-standard),
      background-color var(--duration-short) var(--ease-standard);
  }
  .send-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }
  .send-btn:hover {
    color: var(--color-accent-text);
    background-color: var(--color-bg-sunken);
  }

  /* Menu — same elevation 3 popover as the status menu (§6), portaled + fixed. */
  .menu {
    position: fixed;
    z-index: 60;
    padding: var(--spacing-1);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
  }
  .group-label {
    padding: var(--spacing-0h) var(--spacing-1);
    font-size: var(--text-2xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-tertiary);
  }
  .group-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-0h);
    margin-bottom: var(--spacing-1);
  }
  .group-row:last-child {
    margin-bottom: 0;
  }
  .menuitem {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2.5rem;
    padding-inline: var(--spacing-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    color: var(--color-text-primary);
    background-color: var(--color-bg-sunken);
    cursor: pointer;
    transition:
      color var(--duration-short) var(--ease-standard),
      background-color var(--duration-short) var(--ease-standard);
  }
  .menuitem:hover,
  .menuitem:focus-visible {
    color: var(--color-accent-text);
    background-color: var(--color-accent-subtle);
  }
</style>
