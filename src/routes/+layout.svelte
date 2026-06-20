<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import TabBar from '$lib/components/TabBar.svelte';
  import OverlayHost from '$lib/components/OverlayHost.svelte';
  import DropZone from '$lib/components/DropZone.svelte';
  import { authClient } from '$lib/auth-client';

  let { children } = $props();

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
  <div class="min-h-dvh">
    <header class="account-bar container-app">
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

    <TabBar />

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

  /* Keep content clear of the fixed bottom tab bar (tab-bar-height + safe area). */
  main {
    padding-top: var(--spacing-2);
    padding-bottom: calc(
      var(--tab-bar-height) + env(safe-area-inset-bottom, 0px) + var(--spacing-3)
    );
  }
</style>
