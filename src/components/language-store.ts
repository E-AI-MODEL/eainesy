'use client';

/**
 * Language store — a tiny external store (localStorage-backed) consumed via
 * useSyncExternalStore. This satisfies the react-hooks/set-state-in-effect
 * rule while keeping hydration safe: React renders the server snapshot ('nl')
 * during hydration and re-syncs to the stored preference afterwards.
 */
import type { Lang } from '@/lib/i18n';

const LANG_KEY = 'eainesy.lang';
/** Pre-rename key — read once as fallback so an existing language preference survives the rename. */
const LANG_KEY_LEGACY = 'kwast.lang';

type Listener = () => void;
const listeners = new Set<Listener>();
let cached: Lang | null = null;

function readFromStorage(): Lang {
  if (typeof window === 'undefined') return 'nl';
  try {
    const stored = window.localStorage.getItem(LANG_KEY) ?? window.localStorage.getItem(LANG_KEY_LEGACY);
    return stored === 'en' ? 'en' : 'nl';
  } catch {
    return 'nl';
  }
}

function snapshot(): Lang {
  if (cached === null) cached = readFromStorage();
  return cached;
}

function serverSnapshot(): Lang {
  return 'nl';
}

function notify() {
  for (const fn of listeners) fn();
}

function setLang(l: Lang) {
  cached = l;
  try {
    window.localStorage.setItem(LANG_KEY, l);
  } catch {
    // ignore — in-memory fallback
  }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  notify();
}

function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  // Cross-tab sync (optional but cheap)
  if (typeof window !== 'undefined') {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANG_KEY) {
        cached = readFromStorage();
        if (typeof document !== 'undefined') document.documentElement.lang = cached;
        fn();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener('storage', onStorage);
    };
  }
  return () => {
    listeners.delete(fn);
  };
}

export const languageStore = { snapshot, serverSnapshot, subscribe, setLang };
