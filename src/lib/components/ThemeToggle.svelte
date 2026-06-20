<script lang="ts">
  import { themeUi, setTheme, type ThemePref } from '$lib/stores/theme.svelte';

  // Light → auto → dark spectrum order. The thumb's translateX is index-based,
  // so this array order also defines the visual order.
  const OPTIONS: { pref: ThemePref; label: string; icon: string }[] = [
    {
      pref: 'light',
      label: 'Parchment',
      icon: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z'
    },
    {
      pref: 'system',
      label: 'System',
      icon: 'M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25'
    },
    {
      pref: 'dark',
      label: 'Ink',
      icon: 'M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z'
    }
  ];

  const activeIndex = $derived(OPTIONS.findIndex((o) => o.pref === themeUi.pref));
</script>

<div class="theme-toggle" role="radiogroup" aria-label="Colour theme">
  <span
    class="thumb"
    aria-hidden="true"
    style={`transform: translateX(${activeIndex * 100}%);`}
  ></span>
  {#each OPTIONS as opt (opt.pref)}
    <button
      type="button"
      role="radio"
      class="segment"
      class:active={themeUi.pref === opt.pref}
      aria-checked={themeUi.pref === opt.pref}
      aria-label={`${opt.label} theme`}
      title={opt.label}
      onclick={() => setTheme(opt.pref)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d={opt.icon} />
      </svg>
      <span class="sr-only">{opt.label}</span>
    </button>
  {/each}
</div>

<style>
  .theme-toggle {
    position: relative;
    display: inline-flex;
    align-items: stretch;
    padding: 3px;
    border: 1px solid var(--color-border-base);
    border-radius: var(--radius-full);
    background-color: var(--color-bg-elevated);
  }

  /* Sliding active indicator — width matches one segment (1/3 of the track,
     accounting for the 3px padding via the segments' own box). transform-only,
     premium curve (design-system.md §5/§6). */
  .thumb {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: 36px;
    border-radius: var(--radius-full);
    background-color: var(--color-accent-subtle);
    border: 1px solid var(--color-accent);
    transition: transform var(--duration-base) var(--ease-premium);
  }

  .segment {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 34px;
    border-radius: var(--radius-full);
    color: var(--color-text-tertiary);
    background-color: transparent;
    cursor: pointer;
    transition: color var(--duration-base) var(--ease-premium);
  }
  .segment:hover {
    color: var(--color-text-secondary);
  }
  .segment.active {
    color: var(--color-accent-text);
  }
  .segment svg {
    width: 1.125rem;
    height: 1.125rem;
  }

  /* Extend the hit area to a comfortable target without enlarging the visual
     control (design-system.md §8 / touch-target-size). */
  .segment::after {
    content: '';
    position: absolute;
    inset: -5px 0;
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
    .thumb {
      transition: none;
    }
  }
</style>
