'use client';

import { useEffect } from 'react';
import styles from '@/styles/FormModal.module.css';

/**
 * Shared modal shell for form workflows (not confirm dialogs).
 */
export default function FormModal({
  open,
  onClose,
  title,
  children,
  actions,
  wide = false,
  className = '',
  closeOnOverlay = true,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={() => {
        if (closeOnOverlay) onClose?.();
      }}
    >
      <div
        className={[styles.modal, wide ? styles.wide : '', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : '对话框'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          {title ? <h2 className={styles.title}>{title}</h2> : <span />}
          <button type="button" className={styles.close} onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </div>
  );
}
