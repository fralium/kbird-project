/** 统一轻提示：优先 ToastManager 挂载的 window.showToast */
export function showToast(message, type = 'info', duration = 2800) {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(message, type, duration);
    return;
  }
  if (typeof console !== 'undefined') {
    console[type === 'error' ? 'error' : 'log'](message);
  }
}
