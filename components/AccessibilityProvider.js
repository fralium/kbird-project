import { createContext, useContext, useEffect, useState } from 'react';

const AccessibilityContext = createContext();

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

export const AccessibilityProvider = ({ children }) => {
  const [preferences, setPreferences] = useState({
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    screenReader: false
  });

  useEffect(() => {
    // 检测用户偏好
    const detectPreferences = () => {
      // 检测高对比度模式
      const highContrast = window.matchMedia('(prefers-contrast: high)').matches;
      
      // 检测减少动画偏好
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      // 检测屏幕阅读器
      const screenReader = window.navigator.userAgent.includes('NVDA') || 
                          window.navigator.userAgent.includes('JAWS') ||
                          window.navigator.userAgent.includes('VoiceOver');
      
      setPreferences({
        highContrast,
        largeText: localStorage.getItem('largeText') === 'true',
        reducedMotion,
        screenReader
      });
    };

    detectPreferences();

    // 监听系统偏好变化
    const mediaQueries = [
      window.matchMedia('(prefers-contrast: high)'),
      window.matchMedia('(prefers-reduced-motion: reduce)')
    ];

    const handleChange = () => detectPreferences();
    mediaQueries.forEach(mq => mq.addEventListener('change', handleChange));

    return () => {
      mediaQueries.forEach(mq => mq.removeEventListener('change', handleChange));
    };
  }, []);

  const togglePreference = (key) => {
    const newValue = !preferences[key];
    setPreferences(prev => ({ ...prev, [key]: newValue }));
    
    if (key === 'largeText') {
      localStorage.setItem('largeText', newValue.toString());
    }
  };

  const value = {
    preferences,
    togglePreference,
    isHighContrast: preferences.highContrast,
    isLargeText: preferences.largeText,
    isReducedMotion: preferences.reducedMotion,
    isScreenReader: preferences.screenReader
  };

  return (
    <AccessibilityContext.Provider value={value}>
      <div 
        className={`accessibility-wrapper ${
          preferences.highContrast ? 'high-contrast' : ''
        } ${
          preferences.largeText ? 'large-text' : ''
        } ${
          preferences.reducedMotion ? 'reduced-motion' : ''
        }`}
      >
        {children}
      </div>
    </AccessibilityContext.Provider>
  );
};
