import { useSyncExternalStore } from 'react';

const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)') : null;

function subscribe(cb: () => void) {
  mq?.addEventListener('change', cb);
  return () => mq?.removeEventListener('change', cb);
}

function getSnapshot() {
  return mq?.matches ?? false;
}

export function useMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
