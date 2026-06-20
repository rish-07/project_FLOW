<script lang="ts">
  export let title: string;
  export let description = '';
  export let overline = '';
</script>

<section class="flex min-h-[55dvh] flex-col items-center justify-center text-center">
  <div
    class="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)] shadow-xs"
  >
    <slot name="icon" />
  </div>
  {#if overline}
    <p class="overline mb-1">{overline}</p>
  {/if}
  <h1 class="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h1>
  {#if description}
    <p class="mt-1 max-w-xs text-sm text-[var(--color-text-secondary)]">{description}</p>
  {/if}
  {#if $$slots.action}
    <div class="mt-3"><slot name="action" /></div>
  {/if}
</section>
