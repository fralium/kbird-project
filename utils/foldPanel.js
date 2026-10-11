'use client';

import { useCallback, useEffect, useState } from 'react';

export function readFoldOpen(storageKey, defaultOpen = false) {
  if (typeof window === 'undefined' || !storageKey) return defaultOpen;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return defaultOpen;
    return raw === '1' || raw === 'true';
  } catch {
    return defaultOpen;
  }
}

export function writeFoldOpen(storageKey, open) {
  if (typeof window === 'undefined' || !storageKey) return;
  try {
    localStorage.setItem(storageKey, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Persist fold open/closed in localStorage. */
export function useFoldOpen(storageKey, defaultOpen = false) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(readFoldOpen(storageKey, defaultOpen));
  }, [storageKey, defaultOpen]);

  const setFoldOpen = useCallback(
    (next) => {
      setOpen((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        writeFoldOpen(storageKey, value);
        return value;
      });
    },
    [storageKey]
  );

  const toggle = useCallback(() => {
    setFoldOpen((prev) => !prev);
  }, [setFoldOpen]);

  return [open, setFoldOpen, toggle];
}
