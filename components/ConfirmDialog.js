'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import styles from '@/styles/ConfirmDialog.module.css';

export default function ConfirmDialog({
  open,
  title = '确认删除',
  message,
  confirmLabel = '确认删除',
  cancelLabel = '取消',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef(null);
  const dialogRef = useRef(null);

  useFocusTrap(dialogRef, open, { initialFocusRef: cancelRef });

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onCancel?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onClick={() => {
        if (!busy) onCancel?.();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId}>{title}</h3>
        <p id={descId}>{message}</p>
        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button type="button" className={styles.confirm} onClick={onConfirm} disabled={busy}>
            {busy ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirmDialog() {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const ask = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : options || {};
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        title: opts.title || '确认删除',
        message: opts.message || '确定删除？此操作不可撤销。',
        confirmLabel: opts.confirmLabel || '确认删除',
        cancelLabel: opts.cancelLabel || '取消',
      });
    });
  }, []);

  const finish = useCallback((ok) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setState(null);
    if (resolve) resolve(ok);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={Boolean(state)}
      title={state?.title}
      message={state?.message}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
    />
  );

  return { ask, dialog };
}
