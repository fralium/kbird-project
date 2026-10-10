import { useState, useCallback, useRef } from 'react';
import Toast from './Toast';

const TOAST_DEDUP_TTL_MS = 10_000;

const ToastManager = () => {
  const [toasts, setToasts] = useState([]);
  const recentToastTimesRef = useRef(new Map());

  const addToast = useCallback((message, type = 'success', duration = 3000, options = {}) => {
    const { dedupe = type === 'error', dedupeTtlMs = TOAST_DEDUP_TTL_MS } = options || {};
    const toastKey = `${type}|${String(message || '').trim()}`;
    if (dedupe && toastKey) {
      const now = Date.now();
      const lastAt = recentToastTimesRef.current.get(toastKey) || 0;
      if (now - lastAt < dedupeTtlMs) return;
      recentToastTimesRef.current.set(toastKey, now);
      if (recentToastTimesRef.current.size > 200) {
        recentToastTimesRef.current.clear();
        recentToastTimesRef.current.set(toastKey, now);
      }
    }

    const id = Date.now() + Math.random();
    const newToast = { id, message, type, duration };
    
    setToasts(prev => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // 将addToast方法暴露给全局
  if (typeof window !== 'undefined') {
    window.showToast = addToast;
  }

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, zIndex: 1000 }}>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastManager;
