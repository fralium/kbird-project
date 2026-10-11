'use client';

import { useFoldOpen } from '@/utils/foldPanel';
import styles from '@/styles/FoldFilterPanel.module.css';

/**
 * Collapsible filter panel with optional localStorage persistence.
 */
export default function FoldFilterPanel({
  storageKey,
  defaultOpen = false,
  open: openControlled,
  onOpenChange,
  title = '筛选',
  summary = '',
  children,
  className = '',
  bodyClassName = '',
}) {
  const [storedOpen, setStoredOpen, toggleStored] = useFoldOpen(storageKey, defaultOpen);
  const controlled = typeof openControlled === 'boolean';
  const open = controlled ? openControlled : storedOpen;

  const toggle = () => {
    if (controlled) {
      onOpenChange?.(!open);
      if (storageKey) {
        // keep storage in sync when controlled
        setStoredOpen(!open);
      }
      return;
    }
    toggleStored();
  };

  return (
    <div className={[styles.fold, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={styles.foldToggle}
        onClick={toggle}
        aria-expanded={open}
      >
        <span className={styles.foldToggleTitle}>{title}</span>
        {summary ? <span className={styles.foldToggleSummary}>{summary}</span> : null}
        <span className={styles.foldToggleChevron} aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? (
        <div className={[styles.foldBody, bodyClassName].filter(Boolean).join(' ')}>{children}</div>
      ) : null}
    </div>
  );
}
