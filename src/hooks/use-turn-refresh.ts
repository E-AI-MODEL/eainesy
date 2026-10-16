'use client';

/**
 * useTurnRefresh — re-run a loader whenever a chat turn completes.
 * ChatPanel dispatches the `eainesy:turn` window event after each reply, so
 * live panels (dashboard, logboek, review, verificatie) update THEMSELVES —
 * no manual refresh button needed.
 */
import { useEffect, useRef } from 'react';

export const TURN_EVENT = 'eainesy:turn';

export function dispatchTurnEvent() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(TURN_EVENT));
}

export function useTurnRefresh(refresh: () => void) {
  const ref = useRef(refresh);
  useEffect(() => {
    ref.current = refresh;
  }, [refresh]);
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener(TURN_EVENT, handler);
    return () => window.removeEventListener(TURN_EVENT, handler);
  }, []);
}
