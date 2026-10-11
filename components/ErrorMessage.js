import { useState, useEffect } from 'react';
import styles from '@/styles/ErrorMessage.module.css';

const ErrorMessage = ({ 
  error, 
  onClose, 
  autoClose = true, 
  duration = 5000,
  type = 'error' // 'error', 'warning', 'info', 'success'
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoClose && error) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onClose) onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [error, autoClose, duration, onClose]);

  if (!error || !visible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '❌';
    }
  };

  const getTypeClass = () => {
    switch (type) {
      case 'success': return styles.success;
      case 'warning': return styles.warning;
      case 'info': return styles.info;
      default: return styles.error;
    }
  };

  return (
    <div className={`${styles.errorMessage} ${getTypeClass()}`}>
      <div className={styles.errorContent}>
        <span className={styles.errorIcon}>{getIcon()}</span>
        <span className={styles.errorText}>
          {typeof error === 'string' ? error : error.message || '发生未知错误'}
        </span>
        {onClose && (
          <button 
            className={styles.closeButton}
            onClick={() => {
              setVisible(false);
              onClose();
            }}
            aria-label="关闭错误提示"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
