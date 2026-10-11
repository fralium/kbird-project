import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import styles from '@/styles/LazyImage.module.css';

const LazyImage = ({ 
  src, 
  alt, 
  width, 
  height, 
  className = '', 
  placeholder = null,
  objectFit = 'cover',
  fillContainer = false,
  onLoad,
  onError,
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef();
  const containerRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '50px'
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = (e) => {
    setIsLoaded(true);
    setHasError(false);
    if (onLoad) onLoad(e);
  };

  const handleError = (e) => {
    setHasError(true);
    setIsLoaded(false);
    if (onError) onError(e);
  };

  return (
    <div 
      ref={containerRef}
      className={`${styles.lazyImageContainer} ${fillContainer ? styles.fill : ''} ${className}`}
      style={fillContainer ? undefined : { width, height }}
    >
      {/* 占位符 */}
      {!isInView && (
        <div className={styles.placeholder}>
          {placeholder || <div className={styles.skeleton} />}
        </div>
      )}

      {/* 实际图片 */}
      {isInView && (
        <>
          {!isLoaded && !hasError && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
            </div>
          )}
          
          <Image
            ref={imgRef}
            src={src}
            alt={alt}
            width={typeof width === 'number' ? width : 1200}
            height={typeof height === 'number' ? height : 800}
            unoptimized
            onLoad={handleLoad}
            onError={handleError}
            style={{ 
              opacity: isLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease-in-out',
              objectFit,
            }}
            className={styles.image}
            {...props}
          />
          
          {hasError && (
            <div className={styles.error}>
              <span>图片加载失败</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LazyImage;

