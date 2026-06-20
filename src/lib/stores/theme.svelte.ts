// Theme preference — three states, persisted, flash-free.
//
// The single source of truth for the *initial* paint is the pre-paint script in
// app.html; it reads the same localStorage key and resolution logic mirrored
// here. This store is the runtime authority after hydration: it seeds reactive
// state from storage (so the toggle shows the right segment), writes changes
// back, and keeps "System" live by following OS changes — but only while the
// preference actually is "system".

export type ThemePref = 'system' | 'light' | 'dark';

// Mirrored verbatim in app.html's pre-paint script — keep both in sync.
const STORAGE_KEY = 'theme-pref';

export const themeUi = $state<{ pref: ThemePref }>({ pref: 'system' });

function readStored(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage blocked — fall through to default */
  }
  return 'system';
}

function resolve(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

function applyToDom(pref: ThemePref): void {
  document.documentElement.classList.toggle('dark', resolve(pref) === 'dark');
}

/** Call once, on app mount. Returns a cleanup fn for the OS-change listener. */
export function initTheme(): () => void {
  themeUi.pref = readStored();
  applyToDom(themeUi.pref); // reconcile with pre-paint (no-op if they agree)

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onOsChange = () => {
    if (themeUi.pref === 'system') applyToDom('system');
  };
  mq.addEventListener('change', onOsChange);
  return () => mq.removeEventListener('change', onOsChange);
}

export function setTheme(pref: ThemePref): void {
  themeUi.pref = pref;
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* storage blocked — class still applies for this session */
  }
  applyToDom(pref);
}
