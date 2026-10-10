import { useEffect, useRef, useState } from 'react';
import styles from '../styles/KeyboardNavigation.module.css';

const KeyboardNavigation = ({ 
  children, 
  onNavigate, 
  items = [], 
  orientation = 'horizontal',
  loop = true 
}) => {
  const containerRef = useRef();
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!containerRef.current) return;

      const focusableElements = containerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      const currentIndex = Array.from(focusableElements).indexOf(document.activeElement);
      
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          navigateToNext(focusableElements, currentIndex);
          break;
          
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          navigateToPrevious(focusableElements, currentIndex);
          break;
          
        case 'Home':
          e.preventDefault();
          focusableElements[0]?.focus();
          break;
          
        case 'End':
          e.preventDefault();
          focusableElements[focusableElements.length - 1]?.focus();
          break;
          
        case 'Enter':
        case ' ':
          if (onNavigate && focusedIndex >= 0) {
            e.preventDefault();
            onNavigate(focusedIndex, items[focusedIndex]);
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          document.activeElement?.blur();
          setFocusedIndex(-1);
          break;
      }
    };

    const navigateToNext = (elements, currentIndex) => {
      const nextIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : (loop ? 0 : currentIndex);
      elements[nextIndex]?.focus();
      setFocusedIndex(nextIndex);
      setIsNavigating(true);
      setTimeout(() => setIsNavigating(false), 300);
    };

    const navigateToPrevious = (elements, currentIndex) => {
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : (loop ? elements.length - 1 : currentIndex);
      elements[prevIndex]?.focus();
      setFocusedIndex(prevIndex);
      setIsNavigating(true);
      setTimeout(() => setIsNavigating(false), 300);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [focusedIndex, onNavigate, items, loop]);

  return (
    <div 
      ref={containerRef}
      className={`${styles.keyboardNavigation} ${isNavigating ? styles.navigating : ''}`}
      tabIndex={0}
      role={orientation === 'horizontal' ? 'tablist' : 'list'}
      aria-label="键盘导航"
    >
      {children}
    </div>
  );
};

// 键盘导航钩子
export const useKeyboardNavigation = (items, onSelect) => {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!containerRef.current) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => 
            prev < items.length - 1 ? prev + 1 : 0
          );
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => 
            prev > 0 ? prev - 1 : items.length - 1
          );
          break;
          
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0 && onSelect) {
            onSelect(items[focusedIndex], focusedIndex);
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          setFocusedIndex(-1);
          break;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [focusedIndex, items, onSelect]);

  return {
    containerRef,
    focusedIndex,
    setFocusedIndex
  };
};

// 焦点管理工具
export const FocusManager = {
  // 设置焦点到指定元素
  setFocus: (element) => {
    if (element && typeof element.focus === 'function') {
      element.focus();
    }
  },

  // 获取下一个可聚焦元素
  getNextFocusable: (currentElement) => {
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const currentIndex = Array.from(focusableElements).indexOf(currentElement);
    return focusableElements[currentIndex + 1] || focusableElements[0];
  },

  // 获取上一个可聚焦元素
  getPreviousFocusable: (currentElement) => {
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const currentIndex = Array.from(focusableElements).indexOf(currentElement);
    return focusableElements[currentIndex - 1] || focusableElements[focusableElements.length - 1];
  },

  // 陷阱焦点在指定容器内
  trapFocus: (container) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }
};

export default KeyboardNavigation;

