<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
  let loading = $state(false);
</script>

<svelte:head><title>Set up your account</title></svelte:head>

<main class="auth-screen">
  <div class="auth-card">
    <header class="auth-header">
      <h1 class="auth-title">Create your account</h1>
      <p class="auth-subtitle">Set up the owner account for your workspace. This happens once.</p>
    </header>

    <form
      class="auth-form"
      method="POST"
      use:enhance={() => {
        loading = true;
        return async ({ update }) => {
          await update();
          loading = false;
        };
      }}
    >
      <div class="field">
        <label for="name">Name</label>
        <input
          class="input-field"
          id="name"
          name="name"
          type="text"
          autocomplete="name"
          value={form?.name ?? ''}
          required
        />
      </div>

      <div class="field">
        <label for="email">Email</label>
        <input
          class="input-field"
          id="email"
          name="email"
          type="email"
          autocomplete="email"
          value={form?.email ?? ''}
          required
        />
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input
          class="input-field"
          id="password"
          name="password"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
        />
        <p class="field-hint">At least 8 characters.</p>
      </div>

      {#if form?.error}
        <p class="auth-error" role="alert">{form.error}</p>
      {/if}

      <button class="btn-primary auth-submit" type="submit" disabled={loading}>
        {loading ? 'Creating…' : 'Create account'}
      </button>
    </form>
  </div>
</main>

<style>
  .auth-screen {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 100dvh;
    padding: calc(env(safe-area-inset-top, 0px) + var(--spacing-3)) var(--spacing-2)
      calc(env(safe-area-inset-bottom, 0px) + var(--spacing-3));
  }

  .auth-card {
    width: 100%;
    max-width: 26rem;
    margin-inline: auto;
    padding: var(--spacing-4);
    background-color: var(--color-bg-elevated);
    border: 1px solid var(--color-border-base);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .auth-header {
    margin-bottom: var(--spacing-3);
  }
  .auth-title {
    font-size: var(--text-2xl);
    line-height: var(--leading-snug);
    letter-spacing: var(--tracking-tight);
    font-weight: 600;
    color: var(--color-text-primary);
  }
  .auth-subtitle {
    margin-top: var(--spacing-0h);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }
  .field label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
  }
  .field-hint {
    font-size: var(--text-xs);
    color: var(--color-text-tertiary);
  }

  .auth-error {
    font-size: var(--text-sm);
    color: var(--color-danger-text);
    background-color: var(--color-danger-bg);
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-md);
  }

  .auth-submit {
    margin-top: var(--spacing-1);
    width: 100%;
  }
</style>
