'use client';

/**
 * Steer store — user steering settings ("bijsturing"), localStorage-backed,
 * external store consumed via useSyncExternalStore (same pattern as the
 * language store): hydration-safe and cross-tab consistent.
 */
import { useSyncExternalStore } from 'react';
import { DEFAULT_STEER, normalizeSteer, type SteerSettings } from '@/lib/eainesy/steer';

const STEER_KEY = 'eainesy.steer.v1';
/** Pre-rename key — read once as fallback so existing steering preferences survive the rename. */
const STEER_KEY_LEGACY = 'kwast.steer.v1';

type Listener = () => void;
const listeners = new Set<Listener>();
let cached: SteerSettings | null = null;

function readFromStorage(): SteerSettings {
  if (typeof window === 'undefined') return DEFAULT_STEER;
  try {
    const raw = window.localStorage.getItem(STEER_KEY) ?? window.localStorage.getItem(STEER_KEY_LEGACY);
    if (!raw) return DEFAULT_STEER;
    return normalizeSteer(JSON.parse(raw));
  } catch {
    return DEFAULT_STEER;
  }
}

function snapshot(): SteerSettings {
  if (cached === null) cached = readFromStorage();
  return cached;
}

function serverSnapshot(): SteerSettings {
  return DEFAULT_STEER;
}

function notify() {
  for (const fn of listeners) fn();
}

function setSteer(next: SteerSettings) {
  cached = next;
  try {
    window.localStorage.setItem(STEER_KEY, JSON.stringify(next));
  } catch {
    // ignore — in-memory fallback
  }
  notify();
}

function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  if (typeof window !== 'undefined') {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STEER_KEY) {
        cached = readFromStorage();
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

export const steerStore = { snapshot, serverSnapshot, subscribe, setSteer };

export function useSteer(): { steer: SteerSettings; setSteer: (s: SteerSettings) => void } {
  const steer = useSyncExternalStore(steerStore.subscribe, steerStore.snapshot, steerStore.serverSnapshot);
  return { steer, setSteer: steerStore.setSteer };
}
