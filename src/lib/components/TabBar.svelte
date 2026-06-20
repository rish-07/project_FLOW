<script lang="ts">
  import { page } from '$app/stores';

  // Heroicons v2 — outline (stroke) for inactive, solid (fill) for active.
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

  let pathname = $derived($page.url.pathname);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
</script>

<nav class="tab-bar" aria-label="Primary">
  <ul class="tab-list container-app">
    {#each tabs as tab (tab.href)}
      {@const active = isActive(tab.href)}
      <li class="tab-item">
        <a href={tab.href} aria-current={active ? 'page' : undefined} class="tab-link" class:active>
          <span class="active-rule" aria-hidden="true"></span>
          <svg
            class="tab-icon"
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
          <span class="tab-label">{tab.label}</span>
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .tab-list {
    display: flex;
    align-items: stretch;
    height: var(--tab-bar-height);
  }
  .tab-item {
    flex: 1;
  }
  .tab-link {
    position: relative;
    display: flex;
    height: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-0h);
    color: var(--color-text-tertiary);
    transition: color var(--duration-base) var(--ease-premium);
  }
  .tab-link.active {
    color: var(--color-accent);
  }

  /* Brass rule above the active tab — a deliberate short rule (inset, not
     full-width), like a tab divider in a ledger. The primary active signal;
     icon/label colour is secondary reinforcement (colour-not-only). */
  .active-rule {
    position: absolute;
    top: 0;
    left: 12px;
    right: 12px;
    height: 2px;
    background-color: var(--color-accent);
    opacity: 0;
    transform: scaleX(0.6);
    transform-origin: center;
    transition:
      opacity var(--duration-base) var(--ease-premium),
      transform var(--duration-base) var(--ease-premium);
  }
  .tab-link.active .active-rule {
    opacity: 1;
    transform: scaleX(1);
  }

  .tab-icon {
    width: 1.5rem;
    height: 1.5rem;
  }
  .tab-label {
    font-size: var(--text-xs);
    font-weight: 500;
  }

  @media (prefers-reduced-motion: reduce) {
    .active-rule {
      transition: none;
    }
  }
</style>
