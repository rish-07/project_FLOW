<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import FloatingNav from '$lib/components/nav/FloatingNav.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import OverlayHost from '$lib/components/OverlayHost.svelte';
  import DropZone from '$lib/components/DropZone.svelte';
  import { initTheme } from '$lib/stores/theme.svelte';
  import { authClient } from '$lib/auth-client';

  let { children } = $props();

  // Sync the theme store with the pre-paint class + persisted choice, and keep
  // "System" following the OS while it's selected. Pre-paint already set the
  // class, so this never causes a flash — it only seeds reactive state.
  onMount(() => initTheme());

  // /login and /setup are standalone full-screen routes — they render outside
  // the bottom-tab app shell (no tab bar, no account bar).
  const AUTH_ROUTES = ['/login', '/setup'];
  let isAuthRoute = $derived(AUTH_ROUTES.some((p) => $page.url.pathname.startsWith(p)));

  async function signOut() {
    await authClient.signOut();
    await goto('/login');
  }
</script>

{#if isAuthRoute}
  {@render children?.()}
{:else}
  <div class="app-shell">
    <header class="account-bar container-app">
      <ThemeToggle />
      <button class="signout-btn" type="button" onclick={signOut}>
        <svg
          class="h-5 w-5"
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
          />
        </svg>
        <span>Sign out</span>
      </button>
    </header>

    <main class="container-app">
      {@render children?.()}
    </main>

    <FloatingNav />

    <!-- Planned-feature seams (Phase 8): overlay host is idle until a status
         transition opens it; the dropzone routes drops into upload→confirm. -->
    <OverlayHost />
    <DropZone />
  </div>
{/if}

<style>
  /* Account area — slim, right-aligned, safe-area aware. Doesn't touch the tab bar. */
  .account-bar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--spacing-2);
    padding-top: calc(env(safe-area-inset-top, 0px) + var(--spacing-1));
    padding-bottom: var(--spacing-1);
  }

  .signout-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-0h);
    min-height: 44px;
    padding-inline: var(--spacing-2);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
    transition:
      background-color var(--duration-short) var(--ease-standard),
      color var(--duration-short) var(--ease-standard);
  }
  .signout-btn:hover {
    background-color: var(--color-bg-sunken);
    color: var(--color-text-primary);
  }

  /* The nav is a fixed floating pill (FloatingNav), so the shell no longer
     reserves a footer slot — `main` just grows to fill the viewport. */
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }

  /* Reserve clearance so no screen's content or bottom control hides behind the
     floating pill: safe area + pill height (~64px) + its bottom gap + breathing. */
  main {
    flex: 1;
    padding-top: var(--spacing-2);
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 5.5rem);
  }
</style>
