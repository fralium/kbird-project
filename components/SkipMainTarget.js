'use client';

import { useEffect } from 'react';

/**
 * 跳过链接仍指向布局上的 #main-content。
 * 点击时把焦点放到页面自己的 <main>，不再改写 id，避免和 React 水合冲突。
 */
export default function SkipMainTarget() {
  useEffect(() => {
    const onClick = (event) => {
      const link = event.target instanceof Element ? event.target.closest('a.skip-link') : null;
      if (!link) return;
      const pageMain = document.querySelector('main');
      if (!pageMain) return;
      event.preventDefault();
      if (!pageMain.hasAttribute('tabindex')) {
        pageMain.setAttribute('tabindex', '-1');
      }
      pageMain.focus({ preventScroll: false });
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
