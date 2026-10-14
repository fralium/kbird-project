'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Point skip-link (#main-content) at the page <main> landmark when present,
 * so focus lands on primary content rather than the outer shell (which includes nav).
 */
export default function SkipMainTarget() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const shell = document.getElementById('main-content');
    const pageMain = document.querySelector('main');
    if (!pageMain) return undefined;

    const prevId = pageMain.id;
    pageMain.id = 'main-content';
    if (shell && shell !== pageMain) {
      shell.removeAttribute('id');
      shell.setAttribute('data-main-shell', 'true');
    }

    return () => {
      if (prevId) pageMain.id = prevId;
      else pageMain.removeAttribute('id');
      if (shell && shell.getAttribute('data-main-shell') === 'true') {
        shell.id = 'main-content';
        shell.removeAttribute('data-main-shell');
      }
    };
  }, [pathname]);

  return null;
}
