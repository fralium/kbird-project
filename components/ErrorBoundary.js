import React from 'react';
import styles from '../styles/ErrorBoundary.module.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // 可以在这里添加错误报告逻辑
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false
      });
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, retryCount } = this.state;
      const isRetryLimitReached = retryCount >= 3;

      return (
        <div className={styles.errorBoundary}>
          <div className={styles.errorContainer}>
            <div className={styles.errorIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            
            <h2 className={styles.errorTitle}>出现了一些问题</h2>
            <p className={styles.errorMessage}>
              {isRetryLimitReached 
                ? '多次重试后仍然出现问题，建议刷新页面'
                : '页面遇到了意外错误，请尝试重试'
              }
            </p>
            
            {process.env.NODE_ENV === 'development' && error && (
              <details className={styles.errorDetails}>
                <summary>错误详情 (开发模式)</summary>
                <pre className={styles.errorStack}>
                  {error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            
            <div className={styles.errorActions}>
              {!isRetryLimitReached && (
                <button 
                  onClick={this.handleRetry}
                  className={styles.retryButton}
                >
                  重试 ({retryCount}/3)
                </button>
              )}
              
              <button 
                onClick={this.handleReload}
                className={styles.reloadButton}
              >
                刷新页面
              </button>
              
              <button 
                onClick={() => window.history.back()}
                className={styles.backButton}
              >
                返回上页
              </button>
            </div>
            
            <div className={styles.errorHelp}>
              <p>如果问题持续存在，请联系技术支持</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
