import { useState, useEffect } from 'react';
import styles from '@/styles/Toast.module.css';

const Toast = ({ message, type = 'success', duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // 进入动画
    const timer1 = setTimeout(() => setIsVisible(true), 100);
    
    // 自动消失
    const timer2 = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => {
        onClose();
      }, 300);
    }, duration);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [duration, onClose]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      default:
        return '✅';
    }
  };

  return (
    <div 
      className={`${styles.toast} ${styles[type]} ${isVisible ? styles.show : ''} ${isLeaving ? styles.leave : ''}`}
      onClick={handleClose}
    >
      <div className={styles.toastContent}>
        <span className={styles.icon}>{getIcon()}</span>
        <span className={styles.message}>{message}</span>
        <button className={styles.closeButton} onClick={handleClose}>
          ×
        </button>
      </div>
      <div className={styles.progressBar}>
        <div className={styles.progressFill}></div>
      </div>
    </div>
  );
};

export default Toast;
