import { useState } from 'react';
import styles from '../styles/ErrorBoundary.module.css';

const ErrorBoundary = ({ children, fallback = null }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  const handleError = (error, errorInfo) => {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    setHasError(true);
    setError(error);
  };

  if (hasError) {
    return fallback || (
      <div className={styles.errorContainer}>
        <div className={styles.errorContent}>
          <h2>出现错误</h2>
          <p>抱歉，页面遇到了问题。请刷新页面重试。</p>
          <button 
            className={styles.retryButton}
            onClick={() => {
              setHasError(false);
              setError(null);
              window.location.reload();
            }}
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default ErrorBoundary;
