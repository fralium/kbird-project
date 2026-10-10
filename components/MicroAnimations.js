import { useEffect, useRef } from 'react';

// 微交互动画组件
export const FadeInOnScroll = ({ children, delay = 0, duration = 0.6 }) => {
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              entry.target.style.opacity = '1';
              entry.target.style.transform = 'translateY(0)';
            }, delay);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={elementRef}
      style={{
        opacity: 0,
        transform: 'translateY(30px)',
        transition: `opacity ${duration}s ease-out, transform ${duration}s ease-out`,
      }}
    >
      {children}
    </div>
  );
};

// 悬停动画组件
export const HoverScale = ({ children, scale = 1.05 }) => {
  return (
    <div
      style={{
        transition: 'transform 0.3s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `scale(${scale})`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {children}
    </div>
  );
};

// 脉冲动画组件
export const PulseAnimation = ({ children, duration = 2 }) => {
  return (
    <div
      style={{
        animation: `pulse ${duration}s ease-in-out infinite`,
      }}
    >
      {children}
    </div>
  );
};

// 摇摆动画组件
export const WiggleAnimation = ({ children, intensity = 5 }) => {
  return (
    <div
      style={{
        animation: `wiggle 0.5s ease-in-out`,
        cursor: 'pointer',
      }}
      onClick={(event) => {
        // 点击时触发摇摆动画
        const element = event.currentTarget;
        element.style.animation = 'none';
        setTimeout(() => {
          element.style.animation = 'wiggle 0.5s ease-in-out';
        }, 10);
      }}
    >
      {children}
    </div>
  );
};

// 添加CSS动画样式
export const animationStyles = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  
  @keyframes wiggle {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-${5}deg); }
    75% { transform: rotate(${5}deg); }
  }
  
  @keyframes bounce {
    0%, 20%, 53%, 80%, 100% { transform: translateY(0); }
    40%, 43% { transform: translateY(-10px); }
    70% { transform: translateY(-5px); }
    90% { transform: translateY(-2px); }
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
    20%, 40%, 60%, 80% { transform: translateX(2px); }
  }
`;

const microAnimations = {
  FadeInOnScroll,
  HoverScale,
  PulseAnimation,
  WiggleAnimation,
  animationStyles,
};

export default microAnimations;

