'use client';

import { useEffect } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap Tab focus inside a dialog container while `active` is true.
 * Restores previously focused element on cleanup.
 */
export function useFocusTrap(containerRef, active, { initialFocusRef } = {}) {
  useEffect(() => {
    if (!active) return undefined;
    const container = containerRef?.current;
    if (!container) return undefined;

    const previouslyFocused =
      typeof document !== 'undefined' ? document.activeElement : null;

    const focusInitial = () => {
      const preferred = initialFocusRef?.current;
      if (preferred && typeof preferred.focus === 'function') {
        preferred.focus();
        return;
      }
      const first = container.querySelector(FOCUSABLE);
      first?.focus?.();
    };

    const handleKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const nodes = Array.from(container.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first || !container.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !container.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    requestAnimationFrame(focusInitial);
    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef, initialFocusRef]);
}

export default useFocusTrap;
